import { bookings } from "@voyantjs/bookings/schema"
import type { EventBus } from "@voyantjs/core"
import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { invoiceLineItems, invoices, payments } from "./schema.js"
import {
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

export interface InvoiceIssueRuntime {
  eventBus?: EventBus
}

export interface InvoiceIssuedEvent {
  invoiceId: string
  invoiceNumber: string
  invoiceType: "invoice" | "proforma" | "credit_note"
  bookingId: string | null
  totalCents: number
  currency: string
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
}

export interface InvoiceIssuedLineItem {
  description: string
  quantity: number
  unitPrice: number
  currency: string
  taxPercentage?: number
  isService?: boolean
}

const ISSUED_EVENT = "invoice.issued"
const PROFORMA_ISSUED_EVENT = "invoice.proforma.issued"

/**
 * Create + emit an invoice from a booking. Returns the persisted row
 * after flipping the status from `draft` → `sent`. The status flip is
 * what consumers treat as "issued" — drafts shouldn't trigger
 * SmartBill sync.
 */
export async function issueInvoiceFromBooking(
  db: PostgresJsDatabase,
  input: CreateInvoiceFromBookingInput,
  bookingData: InvoiceFromBookingData,
  runtime: InvoiceIssueRuntime = {},
) {
  const draft = await financeService.createInvoiceFromBooking(db, input, bookingData)
  if (!draft) return null

  const [issued] = await db
    .update(invoices)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, draft.id))
    .returning()

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
  const draft = await financeService.createInvoiceFromBooking(db, input, bookingData)
  if (!draft) return null

  const [issued] = await db
    .update(invoices)
    .set({ invoiceType: "proforma", status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, draft.id))
    .returning()

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
  const [booking] = invoice.bookingId
    ? await db.select().from(bookings).where(eq(bookings.id, invoice.bookingId)).limit(1)
    : []
  const lines = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoice.id))
    .orderBy(asc(invoiceLineItems.sortOrder))
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
    lineItems: lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: centsToMajor(line.unitPriceCents),
      currency: invoice.currency,
      ...(line.taxRate == null ? {} : { taxPercentage: line.taxRate }),
      isService: true,
    })),
    bookingNumber: booking?.bookingNumber ?? null,
    issueDate: toDateString(invoice.issueDate),
    dueDate: toDateString(invoice.dueDate),
  }
  await runtime.eventBus.emit(eventName, payload)
}

/**
 * Convert an issued proforma into a final invoice. Copies the proforma's
 * line items verbatim (totals + taxes already match the booking the
 * customer accepted) and voids the proforma so it stops counting against
 * outstanding balances. The new invoice carries `convertedFromInvoiceId`
 * so the audit chain is preserved; downstream subscribers (SmartBill
 * etc.) see the linkage on the emitted `invoice.issued` event.
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
        status: "sent",
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
      .set({ invoiceId: inserted.id, updatedAt: new Date() })
      .where(eq(payments.invoiceId, proforma.id))

    await tx
      .update(invoices)
      .set({ status: "void", updatedAt: new Date() })
      .where(eq(invoices.id, proforma.id))

    return inserted
  })

  if (!created) return { status: "not_found" }

  await emitIssued(db, runtime, ISSUED_EVENT, created)
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
