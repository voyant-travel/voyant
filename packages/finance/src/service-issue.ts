import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyantjs/action-ledger"
import { bookingItems, bookings } from "@voyantjs/bookings/schema"
import type { EventBus } from "@voyantjs/core"
import { asc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { resolveBookingSellTaxRate } from "./booking-tax.js"
import { type InvoiceFxOptions, resolveInvoiceFxContext } from "./invoice-fx.js"
import {
  bookingItemTaxLines,
  invoiceLineItems,
  invoiceNumberSeries,
  invoices,
  payments,
} from "./schema.js"
import {
  buildInvoiceIssuedActionLedgerInput,
  type CreateInvoiceFromBookingInput,
  financeService,
  type InvoiceFromBookingData,
} from "./service.js"

/**
 * Issue / proforma orchestration helpers that wrap the bare invoice
 * creators with EventBus emissions so subscribers (SmartBill plugin,
 * checkout-finalize workflow) can react.
 *
 * `createInvoice*` services in `service.ts` stay pure DB writers —
 * the workflow / route layer chooses when to mark them as "issued"
 * (a status change that's also a system signal).
 */

export interface InvoiceIssueRuntime extends InvoiceFxOptions {
  eventBus?: EventBus
  actionLedgerContext?: ActionLedgerRequestContextValues
  actionLedgerAuthorizationSource?: string | null
}

export interface InvoiceIssuedEvent {
  invoiceId: string
  invoiceNumber: string
  invoiceType: "invoice" | "proforma" | "credit_note"
  bookingId: string | null
  totalCents: number
  currency: string
  /** Operator accounting/reporting currency when different from `currency`. */
  baseCurrency?: string
  /** Rate set used to resolve `currency` -> `baseCurrency`, when available. */
  fxRateSetId?: string
  /** Spot rate for `currency` → `baseCurrency`. */
  fxRate?: number
  /** Provider or reference source for `fxRate`, for example `bnr`. */
  fxRateSource?: string
  /** Provider timestamp for the quoted spot rate. */
  fxRateQuotedAt?: string
  /** Provider timestamp after which the quoted spot rate is stale. */
  fxRateValidUntil?: string
  /** Operator FX commission added on top of the spot rate. */
  fxCommissionBps?: number
  /** `fxRate` after commission. Invoice providers should prefer this rate. */
  effectiveRate?: number
  /** Optional invoice mention appended by providers when commission is non-zero. */
  fxCommissionInvoiceMention?: string
  /** Linkage when this invoice replaced a proforma. */
  convertedFromInvoiceId?: string | null
  clientName?: string
  clientEmail?: string | null
  clientPhone?: string | null
  clientAddress?: string | null
  clientCity?: string | null
  clientCounty?: string | null
  clientCountry?: string | null
  clientVatCode?: string | null
  clientRegCom?: string | null
  lineItems?: InvoiceIssuedLineItem[]
  bookingNumber?: string | null
  issueDate?: string
  dueDate?: string
  externalAllocationRequired?: boolean
  externalProvider?: string | null
  externalConfigKey?: string | null
  externalSeriesId?: string | null
  externalPlaceholderNumber?: string | null
}

export interface InvoiceIssuedLineItem {
  description: string
  quantity: number
  unitPrice: number
  currency: string
  taxPercentage?: number
  taxName?: string | null
  taxRegimeCode?: TaxRegimeCode | null
  isService?: boolean
}

export type TaxRegimeCode =
  | "standard"
  | "reduced"
  | "exempt"
  | "reverse_charge"
  | "margin_scheme_art311"
  | "zero_rated"
  | "out_of_scope"
  | "other"

type InvoiceLineTaxMetadata = {
  taxPercentage?: number
  taxName?: string | null
  taxRegimeCode?: TaxRegimeCode | null
}

const TAX_REGIME_CODES = new Set<TaxRegimeCode>([
  "standard",
  "reduced",
  "exempt",
  "reverse_charge",
  "margin_scheme_art311",
  "zero_rated",
  "out_of_scope",
  "other",
])

const ISSUED_EVENT = "invoice.issued"
const PROFORMA_ISSUED_EVENT = "invoice.proforma.issued"
const PROFORMA_CONVERTED_EVENT = "invoice.proforma.converted"

export interface InvoiceProformaConvertedEvent extends InvoiceIssuedEvent {
  id: string
  proformaId: string
  proformaInvoiceNumber: string
}

/**
 * Create + emit an invoice from a booking. Returns the persisted row
 * after flipping the status from `draft` to `issued`. Drafts shouldn't
 * trigger SmartBill sync.
 */
export async function issueInvoiceFromBooking(
  db: PostgresJsDatabase,
  input: CreateInvoiceFromBookingInput,
  bookingData: InvoiceFromBookingData,
  runtime: InvoiceIssueRuntime = {},
) {
  const draft = await financeService.createInvoiceFromBooking(db, input, bookingData, runtime)
  if (!draft) return null
  const status = draft.status === "pending_external_allocation" ? draft.status : "issued"

  const updateIssuedInvoice = (writer: PostgresJsDatabase) =>
    writer
      .update(invoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(invoices.id, draft.id))
      .returning()

  const actionLedgerContext = runtime.actionLedgerContext
  const issued = actionLedgerContext
    ? await db.transaction(async (tx) => {
        const [row] = await updateIssuedInvoice(tx)

        if (row) {
          await appendActionLedgerMutation(
            tx,
            await buildInvoiceIssuedActionLedgerInput(
              actionLedgerContext,
              { invoice: row },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return row
      })
    : (await updateIssuedInvoice(db))[0]

  const row = issued ?? draft
  await emitIssued(db, runtime, ISSUED_EVENT, row)
  return row
}

/**
 * Create + emit a proforma from a booking. Same shape as
 * `issueInvoiceFromBooking` but marks the row as `invoiceType:
 * 'proforma'` and emits the proforma-specific event so the
 * SmartBill plugin can route to its proforma endpoint.
 */
export async function issueProformaFromBooking(
  db: PostgresJsDatabase,
  input: CreateInvoiceFromBookingInput,
  bookingData: InvoiceFromBookingData,
  runtime: InvoiceIssueRuntime = {},
) {
  const draft = await financeService.createInvoiceFromBooking(db, input, bookingData, runtime)
  if (!draft) return null
  const status = draft.status === "pending_external_allocation" ? draft.status : "issued"

  const updateIssuedInvoice = (writer: PostgresJsDatabase) =>
    writer
      .update(invoices)
      .set({ invoiceType: "proforma", status, updatedAt: new Date() })
      .where(eq(invoices.id, draft.id))
      .returning()

  const actionLedgerContext = runtime.actionLedgerContext
  const issued = actionLedgerContext
    ? await db.transaction(async (tx) => {
        const [row] = await updateIssuedInvoice(tx)

        if (row) {
          await appendActionLedgerMutation(
            tx,
            await buildInvoiceIssuedActionLedgerInput(
              actionLedgerContext,
              { invoice: row },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return row
      })
    : (await updateIssuedInvoice(db))[0]

  const row = issued ?? draft
  await emitIssued(db, runtime, PROFORMA_ISSUED_EVENT, row)
  return row
}

async function emitIssued(
  db: PostgresJsDatabase,
  runtime: InvoiceIssueRuntime,
  eventName: typeof ISSUED_EVENT | typeof PROFORMA_ISSUED_EVENT,
  invoice: typeof invoices.$inferSelect,
): Promise<void> {
  if (!runtime.eventBus) return
  await runtime.eventBus.emit(eventName, await buildInvoiceIssuedEvent(db, invoice, runtime))
}

async function emitProformaConverted(
  db: PostgresJsDatabase,
  runtime: InvoiceIssueRuntime,
  invoice: typeof invoices.$inferSelect,
  proforma: typeof invoices.$inferSelect,
): Promise<void> {
  if (!runtime.eventBus) return
  const issuedEvent = await buildInvoiceIssuedEvent(db, invoice, runtime)
  const payload: InvoiceProformaConvertedEvent = {
    ...issuedEvent,
    id: issuedEvent.invoiceId,
    proformaId: proforma.id,
    proformaInvoiceNumber: proforma.invoiceNumber,
  }
  await runtime.eventBus.emit(ISSUED_EVENT, issuedEvent)
  await runtime.eventBus.emit(PROFORMA_CONVERTED_EVENT, payload)
}

export async function buildInvoiceIssuedEvent(
  db: PostgresJsDatabase,
  invoice: typeof invoices.$inferSelect,
  runtime: InvoiceIssueRuntime = {},
): Promise<InvoiceIssuedEvent> {
  const [booking] = invoice.bookingId
    ? await db.select().from(bookings).where(eq(bookings.id, invoice.bookingId)).limit(1)
    : []
  const [series] =
    invoice.seriesId && invoice.status === "pending_external_allocation"
      ? await db
          .select()
          .from(invoiceNumberSeries)
          .where(eq(invoiceNumberSeries.id, invoice.seriesId))
          .limit(1)
      : []
  const lines = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoice.id))
    .orderBy(asc(invoiceLineItems.sortOrder))
  const taxMetadataByBookingItemId = await loadLineTaxMetadata(db, lines)
  const payload: InvoiceIssuedEvent = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    bookingId: invoice.bookingId,
    totalCents: invoice.totalCents,
    currency: invoice.currency,
    convertedFromInvoiceId: invoice.convertedFromInvoiceId,
    clientName: buildClientName(booking),
    clientEmail: booking?.contactEmail ?? null,
    clientPhone: booking?.contactPhone ?? null,
    clientAddress: booking?.contactAddressLine1 ?? null,
    clientCity: booking?.contactCity ?? null,
    clientCounty: booking?.contactRegion ?? null,
    clientCountry: booking?.contactCountry ?? null,
    clientVatCode: null,
    clientRegCom: null,
    lineItems: lines.map((line) => {
      const taxMetadata =
        line.bookingItemId == null ? undefined : taxMetadataByBookingItemId.get(line.bookingItemId)
      const taxPercentage = line.taxRate ?? taxMetadata?.taxPercentage

      return {
        description: line.description,
        quantity: line.quantity,
        unitPrice: centsToMajor(line.unitPriceCents),
        currency: invoice.currency,
        ...(taxPercentage == null ? {} : { taxPercentage }),
        ...(taxMetadata?.taxName == null ? {} : { taxName: taxMetadata.taxName }),
        ...(taxMetadata?.taxRegimeCode == null ? {} : { taxRegimeCode: taxMetadata.taxRegimeCode }),
        isService: true,
      }
    }),
    bookingNumber: booking?.bookingNumber ?? null,
    issueDate: toDateString(invoice.issueDate),
    dueDate: toDateString(invoice.dueDate),
  }
  if (series?.externalProvider) {
    payload.externalAllocationRequired = true
    payload.externalProvider = series.externalProvider
    payload.externalConfigKey = series.externalConfigKey
    payload.externalSeriesId = series.id
    payload.externalPlaceholderNumber = invoice.invoiceNumber
  }
  const fx = await resolveInvoiceFxContext(db, invoice, runtime)
  if (fx) Object.assign(payload, fx)
  return payload
}

async function loadLineTaxMetadata(
  db: PostgresJsDatabase,
  lines: Array<typeof invoiceLineItems.$inferSelect>,
): Promise<Map<string, InvoiceLineTaxMetadata>> {
  const bookingItemIds = [
    ...new Set(lines.map((line) => line.bookingItemId).filter((id): id is string => Boolean(id))),
  ]
  if (bookingItemIds.length === 0) return new Map()

  const taxLines = await db
    .select({
      bookingItemId: bookingItemTaxLines.bookingItemId,
      name: bookingItemTaxLines.name,
      code: bookingItemTaxLines.code,
      scope: bookingItemTaxLines.scope,
      rateBasisPoints: bookingItemTaxLines.rateBasisPoints,
    })
    .from(bookingItemTaxLines)
    .where(inArray(bookingItemTaxLines.bookingItemId, bookingItemIds))
    .orderBy(
      asc(bookingItemTaxLines.bookingItemId),
      asc(bookingItemTaxLines.sortOrder),
      asc(bookingItemTaxLines.createdAt),
    )

  const taxLinesByBookingItemId = new Map<string, typeof taxLines>()
  for (const taxLine of taxLines) {
    const existing = taxLinesByBookingItemId.get(taxLine.bookingItemId) ?? []
    existing.push(taxLine)
    taxLinesByBookingItemId.set(taxLine.bookingItemId, existing)
  }

  const metadataByBookingItemId = new Map<string, InvoiceLineTaxMetadata>()
  for (const bookingItemId of bookingItemIds) {
    const taxLine = selectEventTaxLine(taxLinesByBookingItemId.get(bookingItemId) ?? [])
    if (!taxLine) continue

    metadataByBookingItemId.set(bookingItemId, {
      ...(taxLine.rateBasisPoints == null
        ? {}
        : { taxPercentage: Math.round(taxLine.rateBasisPoints / 100) }),
      taxName: taxLine.name,
      taxRegimeCode: parseTaxRegimeCode(taxLine.code),
    })
  }

  await backfillMissingLineTaxMetadata(db, bookingItemIds, metadataByBookingItemId)
  return metadataByBookingItemId
}

function selectEventTaxLine<T extends { scope: string; rateBasisPoints: number | null }>(
  taxLines: T[],
): T | null {
  return (
    taxLines.find((taxLine) => taxLine.scope !== "withheld" && taxLine.rateBasisPoints != null) ??
    taxLines.find((taxLine) => taxLine.scope !== "withheld") ??
    null
  )
}

async function backfillMissingLineTaxMetadata(
  db: PostgresJsDatabase,
  bookingItemIds: string[],
  metadataByBookingItemId: Map<string, InvoiceLineTaxMetadata>,
): Promise<void> {
  const missingBookingItemIds = bookingItemIds.filter((id) => !metadataByBookingItemId.has(id))
  if (missingBookingItemIds.length === 0) return

  const productRows = await db
    .select({
      id: bookingItems.id,
      productId: bookingItems.productId,
    })
    .from(bookingItems)
    .where(inArray(bookingItems.id, missingBookingItemIds))

  for (const row of productRows) {
    if (!row.productId) continue
    const taxRate = await resolveBookingSellTaxRate(db, { productId: row.productId })
    if (!taxRate) continue

    metadataByBookingItemId.set(row.id, {
      taxPercentage: Math.round(taxRate.rate * 100),
      taxName: taxRate.label,
      taxRegimeCode: parseTaxRegimeCode(taxRate.code),
    })
  }
}

function parseTaxRegimeCode(code: string | null | undefined): TaxRegimeCode | null {
  const value = code?.split("/").at(-1)
  return value && TAX_REGIME_CODES.has(value as TaxRegimeCode) ? (value as TaxRegimeCode) : null
}

/**
 * Convert an issued proforma into a final invoice. Copies the proforma's
 * line items verbatim (totals + taxes already match the booking the
 * customer accepted) and voids the proforma so it stops counting against
 * outstanding balances. The new invoice carries `convertedFromInvoiceId`
 * so the audit chain is preserved; downstream subscribers see the linkage
 * on both the generic issued event and the conversion-specific event.
 *
 * Number derivation: `PRO-` prefix → `INV-`; otherwise the original
 * number is suffixed with `-INV`. Callers can override via the optional
 * `invoiceNumber` argument when they want a series-derived number.
 */
export async function convertProformaToInvoice(
  db: PostgresJsDatabase,
  proformaId: string,
  options: {
    invoiceNumber?: string
    issueDate?: string
    dueDate?: string
  } = {},
  runtime: InvoiceIssueRuntime = {},
): Promise<
  | { status: "ok"; invoice: typeof invoices.$inferSelect }
  | { status: "not_found" }
  | { status: "not_proforma" }
  | { status: "already_converted" }
> {
  const [proforma] = await db.select().from(invoices).where(eq(invoices.id, proformaId)).limit(1)
  if (!proforma) return { status: "not_found" }
  if (proforma.invoiceType !== "proforma") return { status: "not_proforma" }
  if (proforma.status === "void") return { status: "already_converted" }

  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.convertedFromInvoiceId, proformaId))
    .limit(1)
  if (existing) return { status: "already_converted" }

  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, proformaId))
    .orderBy(asc(invoiceLineItems.sortOrder))

  const newInvoiceNumber =
    options.invoiceNumber ?? deriveInvoiceNumberFromProforma(proforma.invoiceNumber)
  const todayIso = new Date().toISOString().slice(0, 10)
  const issueDate = options.issueDate ?? todayIso
  const dueDate = options.dueDate ?? toDateString(proforma.dueDate)

  const now = new Date()
  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(invoices)
      .values({
        invoiceNumber: newInvoiceNumber,
        invoiceType: "invoice",
        convertedFromInvoiceId: proforma.id,
        seriesId: proforma.seriesId,
        templateId: proforma.templateId,
        taxRegimeId: proforma.taxRegimeId,
        language: proforma.language,
        bookingId: proforma.bookingId,
        personId: proforma.personId,
        organizationId: proforma.organizationId,
        status: "issued",
        currency: proforma.currency,
        baseCurrency: proforma.baseCurrency,
        fxRateSetId: proforma.fxRateSetId,
        subtotalCents: proforma.subtotalCents,
        baseSubtotalCents: proforma.baseSubtotalCents,
        taxCents: proforma.taxCents,
        baseTaxCents: proforma.baseTaxCents,
        totalCents: proforma.totalCents,
        baseTotalCents: proforma.baseTotalCents,
        // Carry the proforma's settled amounts forward — a partially
        // (or fully) paid proforma must convert to an invoice that
        // reflects those payments, otherwise the new invoice shows the
        // full total as outstanding and the payment rows reassigned
        // below would orphan the balance.
        paidCents: proforma.paidCents,
        basePaidCents: proforma.basePaidCents,
        balanceDueCents: proforma.totalCents - proforma.paidCents,
        baseBalanceDueCents:
          proforma.baseTotalCents !== null && proforma.basePaidCents !== null
            ? proforma.baseTotalCents - proforma.basePaidCents
            : proforma.baseTotalCents,
        commissionPercent: proforma.commissionPercent,
        commissionAmountCents: proforma.commissionAmountCents,
        issueDate,
        dueDate,
        notes: proforma.notes,
      })
      .returning()

    if (!inserted) return null

    if (lineItems.length > 0) {
      await tx.insert(invoiceLineItems).values(
        lineItems.map((line) => ({
          invoiceId: inserted.id,
          bookingItemId: line.bookingItemId,
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.totalCents,
          taxRate: line.taxRate,
          sortOrder: line.sortOrder,
        })),
      )
    }

    // Reassign payments off the proforma so they don't sit attached to
    // a void document. The proforma's payment rows become the final
    // invoice's payment history.
    await tx
      .update(payments)
      .set({ invoiceId: inserted.id, updatedAt: now })
      .where(eq(payments.invoiceId, proforma.id))

    await tx
      .update(invoices)
      .set({
        status: "void",
        paidCents: 0,
        basePaidCents: proforma.basePaidCents == null ? null : 0,
        balanceDueCents: 0,
        baseBalanceDueCents: proforma.baseBalanceDueCents == null ? null : 0,
        voidedAt: now,
        voidReason: `Converted to invoice ${inserted.invoiceNumber}`,
        updatedAt: now,
      })
      .where(eq(invoices.id, proforma.id))

    return inserted
  })

  if (!created) return { status: "not_found" }

  await emitProformaConverted(db, runtime, created, proforma)
  return { status: "ok", invoice: created }
}

function deriveInvoiceNumberFromProforma(proformaNumber: string): string {
  if (/^PRO-/i.test(proformaNumber)) {
    return proformaNumber.replace(/^PRO-/i, "INV-")
  }
  return `${proformaNumber}-INV`
}

function buildClientName(booking: typeof bookings.$inferSelect | undefined): string {
  const name = [booking?.contactFirstName, booking?.contactLastName]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
  return name || "Client"
}

function centsToMajor(cents: number): number {
  return cents / 100
}

function toDateString(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10)
}
