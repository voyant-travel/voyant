// agent-quality: file-size exception -- owner: finance; existing service module stays co-located until a dedicated split preserves behavior and tests.
import { bookings } from "@voyant-travel/bookings/schema"
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  bookingGuarantees,
  bookingPaymentSchedules,
  invoiceRenditions,
  invoices,
  paymentInstruments,
  payments,
  voucherRedemptions,
  vouchers,
} from "./schema.js"
import { financeService } from "./service.js"
import type {
  PublicBookingFinanceDocuments,
  PublicBookingFinancePayments,
  PublicFinanceBookingDocument,
  PublicFinanceDocumentLookup,
  PublicFinanceDocumentLookupQuery,
  PublicPaymentOptionsQuery,
  PublicStartPaymentSessionInput,
  PublicValidateVoucherInput,
} from "./validation-public.js"

export interface PublicFinanceRuntimeOptions {
  resolveDocumentDownloadUrl?: (storageKey: string) => Promise<string | null> | string | null
}

function normalizeDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : value
}

function isDefaultInstrument(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false
  }

  const record = metadata as Record<string, unknown>
  return record.default === true || record.isDefault === true
}

function getMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  return metadata as Record<string, unknown>
}

function getMetadataString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function getMetadataNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function getMetadataStringArray(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
}

function maybeUrl(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return /^https?:\/\//i.test(value) ? value : null
}

function getMetadataDownloadUrl(record: Record<string, unknown> | null) {
  return maybeUrl(getMetadataString(record, "url"))
}

function normalizeDocumentLookupQuery(
  query: PublicFinanceDocumentLookupQuery | string,
): PublicFinanceDocumentLookupQuery {
  return typeof query === "string" ? { reference: query } : query
}

function toPublicPaymentTarget(
  session: NonNullable<Awaited<ReturnType<typeof financeService.getPaymentSessionById>>>,
) {
  if (session.bookingPaymentScheduleId) {
    return {
      type: "booking_payment_schedule" as const,
      bookingPaymentScheduleId: session.bookingPaymentScheduleId,
    }
  }
  if (session.bookingGuaranteeId) {
    return { type: "booking_guarantee" as const, bookingGuaranteeId: session.bookingGuaranteeId }
  }
  if (session.invoiceId) {
    return { type: "invoice" as const, invoiceId: session.invoiceId }
  }
  if (session.targetType === "flight_order" && session.targetId) {
    return { type: "flight_order" as const, flightOrderId: session.targetId }
  }
  if (session.bookingId) {
    return { type: "booking" as const, bookingId: session.bookingId }
  }
  if (session.orderId) {
    return { type: "legacy_order" as const, legacyOrderId: session.orderId }
  }
  if (session.provider && session.externalReference) {
    return {
      type: "provider_reference" as const,
      provider: session.provider,
      reference: session.externalReference,
    }
  }
  return null
}

function toPublicPaymentSession(
  session: NonNullable<Awaited<ReturnType<typeof financeService.getPaymentSessionById>>>,
) {
  return {
    id: session.id,
    target: toPublicPaymentTarget(session),
    provenance: null,
    targetType: session.targetType,
    targetId: session.targetId ?? null,
    bookingId: session.bookingId ?? null,
    legacyOrderId: session.orderId ?? null,
    invoiceId: session.invoiceId ?? null,
    bookingPaymentScheduleId: session.bookingPaymentScheduleId ?? null,
    bookingGuaranteeId: session.bookingGuaranteeId ?? null,
    status: session.status,
    provider: session.provider ?? null,
    providerSessionId: session.providerSessionId ?? null,
    providerPaymentId: session.providerPaymentId ?? null,
    externalReference: session.externalReference ?? null,
    clientReference: session.clientReference ?? null,
    currency: session.currency,
    amountCents: session.amountCents,
    paymentMethod: session.paymentMethod ?? null,
    payerEmail: session.payerEmail ?? null,
    payerName: session.payerName ?? null,
    redirectUrl: session.redirectUrl ?? null,
    returnUrl: session.returnUrl ?? null,
    cancelUrl: session.cancelUrl ?? null,
    expiresAt: normalizeDateTime(session.expiresAt),
    completedAt: normalizeDateTime(session.completedAt),
    failureCode: session.failureCode ?? null,
    failureMessage: session.failureMessage ?? null,
    notes: session.notes ?? null,
  }
}

async function mapInvoiceDocument(
  invoice: typeof invoices.$inferSelect,
  renditions: Array<typeof invoiceRenditions.$inferSelect>,
  runtime: PublicFinanceRuntimeOptions = {},
): Promise<PublicFinanceBookingDocument> {
  const selectedRendition =
    renditions.find((rendition) => rendition.status === "ready") ?? renditions[0] ?? null
  const metadata = getMetadataRecord(selectedRendition?.metadata ?? null)
  const resolvedDownloadUrl =
    selectedRendition?.storageKey && runtime.resolveDocumentDownloadUrl
      ? await runtime.resolveDocumentDownloadUrl(selectedRendition.storageKey)
      : null
  const downloadUrl = resolvedDownloadUrl ?? getMetadataDownloadUrl(metadata)

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    invoiceStatus: invoice.status,
    currency: invoice.currency,
    totalCents: invoice.totalCents,
    paidCents: invoice.paidCents,
    balanceDueCents: invoice.balanceDueCents,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    renditionId: selectedRendition?.id ?? null,
    documentStatus: selectedRendition?.status ?? "missing",
    format: selectedRendition?.format ?? null,
    language: selectedRendition?.language ?? null,
    generatedAt: normalizeDateTime(selectedRendition?.generatedAt),
    fileSize: selectedRendition?.fileSize ?? null,
    checksum: selectedRendition?.checksum ?? null,
    downloadUrl,
  }
}

export const publicFinanceService = {
  async getBookingDocuments(
    db: PostgresJsDatabase,
    bookingId: string,
    runtime: PublicFinanceRuntimeOptions = {},
  ): Promise<PublicBookingFinanceDocuments | null> {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .orderBy(desc(invoices.createdAt))

    if (invoiceRows.length === 0) {
      return { bookingId, documents: [] }
    }

    const renditionRows = await db
      .select()
      .from(invoiceRenditions)
      .where(or(...invoiceRows.map((invoice) => eq(invoiceRenditions.invoiceId, invoice.id))))
      .orderBy(desc(invoiceRenditions.createdAt))

    const renditionByInvoiceId = new Map<string, (typeof invoiceRenditions.$inferSelect)[]>()
    for (const rendition of renditionRows) {
      const existing = renditionByInvoiceId.get(rendition.invoiceId) ?? []
      existing.push(rendition)
      renditionByInvoiceId.set(rendition.invoiceId, existing)
    }

    return {
      bookingId,
      documents: await Promise.all(
        invoiceRows.map((invoice) =>
          mapInvoiceDocument(invoice, renditionByInvoiceId.get(invoice.id) ?? [], runtime),
        ),
      ),
    }
  },

  async getDocumentByReference(
    db: PostgresJsDatabase,
    query: PublicFinanceDocumentLookupQuery | string,
    runtime: PublicFinanceRuntimeOptions = {},
  ): Promise<PublicFinanceDocumentLookup | null> {
    const lookup = normalizeDocumentLookupQuery(query)
    const invoiceConditions = [eq(invoices.invoiceNumber, lookup.reference)]
    if (lookup.invoiceType) {
      invoiceConditions.push(eq(invoices.invoiceType, lookup.invoiceType))
    }

    const [invoiceMatch, paymentMatch] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(and(...invoiceConditions))
        .orderBy(desc(invoices.createdAt))
        .limit(2),
      db
        .select({
          invoiceId: payments.invoiceId,
        })
        .from(payments)
        .where(eq(payments.referenceNumber, lookup.reference))
        .orderBy(desc(payments.createdAt))
        .limit(1),
    ])

    if (invoiceMatch.length > 1) {
      return null
    }

    const invoiceId = invoiceMatch[0]?.id ?? paymentMatch[0]?.invoiceId ?? null
    if (!invoiceId) {
      return null
    }

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)

    if (!invoice?.bookingId) {
      return null
    }

    const renditions = await db
      .select()
      .from(invoiceRenditions)
      .where(eq(invoiceRenditions.invoiceId, invoice.id))
      .orderBy(desc(invoiceRenditions.createdAt))

    return {
      bookingId: invoice.bookingId,
      ...(await mapInvoiceDocument(invoice, renditions, runtime)),
    }
  },

  async getBookingDocumentByReference(
    db: PostgresJsDatabase,
    bookingId: string,
    query: PublicFinanceDocumentLookupQuery | string,
    runtime: PublicFinanceRuntimeOptions = {},
  ): Promise<PublicFinanceDocumentLookup | null> {
    const lookup = normalizeDocumentLookupQuery(query)
    const invoiceConditions = [
      eq(invoices.bookingId, bookingId),
      eq(invoices.invoiceNumber, lookup.reference),
    ]
    if (lookup.invoiceType) {
      invoiceConditions.push(eq(invoices.invoiceType, lookup.invoiceType))
    }

    const [invoiceMatch, paymentMatch] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(and(...invoiceConditions))
        .orderBy(desc(invoices.createdAt))
        .limit(2),
      db
        .select({
          invoiceId: payments.invoiceId,
        })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(
          and(eq(invoices.bookingId, bookingId), eq(payments.referenceNumber, lookup.reference)),
        )
        .orderBy(desc(payments.createdAt))
        .limit(1),
    ])

    if (invoiceMatch.length > 1) {
      return null
    }

    const invoiceId = invoiceMatch[0]?.id ?? paymentMatch[0]?.invoiceId ?? null
    if (!invoiceId) {
      return null
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.bookingId, bookingId)))
      .limit(1)

    if (!invoice?.bookingId) {
      return null
    }

    const renditions = await db
      .select()
      .from(invoiceRenditions)
      .where(eq(invoiceRenditions.invoiceId, invoice.id))
      .orderBy(desc(invoiceRenditions.createdAt))

    return {
      bookingId: invoice.bookingId,
      ...(await mapInvoiceDocument(invoice, renditions, runtime)),
    }
  },

  async getBookingPaymentOptions(
    db: PostgresJsDatabase,
    bookingId: string,
    query: PublicPaymentOptionsQuery,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const instrumentConditions = [eq(paymentInstruments.ownerType, "client")]
    if (!query.includeInactive) {
      instrumentConditions.push(eq(paymentInstruments.status, "active"))
    }
    if (query.personId) {
      instrumentConditions.push(eq(paymentInstruments.personId, query.personId))
    }
    if (query.organizationId) {
      instrumentConditions.push(eq(paymentInstruments.organizationId, query.organizationId))
    }
    if (query.provider) {
      instrumentConditions.push(eq(paymentInstruments.provider, query.provider))
    }
    if (query.instrumentType) {
      instrumentConditions.push(eq(paymentInstruments.instrumentType, query.instrumentType))
    }

    const [accounts, schedules, guarantees] = await Promise.all([
      db
        .select()
        .from(paymentInstruments)
        .where(and(...instrumentConditions))
        .orderBy(desc(paymentInstruments.updatedAt))
        .limit(50),
      db
        .select()
        .from(bookingPaymentSchedules)
        .where(
          and(
            eq(bookingPaymentSchedules.bookingId, bookingId),
            or(
              eq(bookingPaymentSchedules.status, "pending"),
              eq(bookingPaymentSchedules.status, "due"),
            ),
          ),
        )
        .orderBy(asc(bookingPaymentSchedules.dueDate), asc(bookingPaymentSchedules.createdAt)),
      db
        .select()
        .from(bookingGuarantees)
        .where(
          and(
            eq(bookingGuarantees.bookingId, bookingId),
            or(
              eq(bookingGuarantees.status, "pending"),
              eq(bookingGuarantees.status, "failed"),
              eq(bookingGuarantees.status, "expired"),
            ),
          ),
        )
        .orderBy(desc(bookingGuarantees.createdAt)),
    ])

    const recommendedSchedule = schedules[0] ?? null
    const recommendedGuarantee = recommendedSchedule === null ? (guarantees[0] ?? null) : null

    return {
      bookingId,
      accounts: accounts.map((account) => ({
        id: account.id,
        label: account.label,
        provider: account.provider ?? null,
        instrumentType: account.instrumentType,
        status: account.status,
        brand: account.brand ?? null,
        last4: account.last4 ?? null,
        expiryMonth: account.expiryMonth ?? null,
        expiryYear: account.expiryYear ?? null,
        isDefault: isDefaultInstrument(account.metadata),
      })),
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        scheduleType: schedule.scheduleType,
        status: schedule.status,
        dueDate: schedule.dueDate,
        currency: schedule.currency,
        amountCents: schedule.amountCents,
        notes: schedule.notes ?? null,
      })),
      guarantees: guarantees.map((guarantee) => ({
        id: guarantee.id,
        bookingPaymentScheduleId: guarantee.bookingPaymentScheduleId ?? null,
        guaranteeType: guarantee.guaranteeType,
        status: guarantee.status,
        currency: guarantee.currency ?? null,
        amountCents: guarantee.amountCents ?? null,
        provider: guarantee.provider ?? null,
        referenceNumber: guarantee.referenceNumber ?? null,
        expiresAt: normalizeDateTime(guarantee.expiresAt),
        notes: guarantee.notes ?? null,
      })),
      recommendedTarget:
        recommendedSchedule || recommendedGuarantee
          ? {
              targetType: recommendedSchedule
                ? ("booking_payment_schedule" as const)
                : ("booking_guarantee" as const),
              targetId: recommendedSchedule?.id ?? recommendedGuarantee?.id ?? null,
            }
          : null,
    }
  },

  async getBookingPayments(
    db: PostgresJsDatabase,
    bookingId: string,
  ): Promise<PublicBookingFinancePayments | null> {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const invoiceRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceType: invoices.invoiceType,
      })
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .orderBy(desc(invoices.createdAt))

    const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]))
    const paymentRows =
      invoiceRows.length > 0
        ? await db
            .select()
            .from(payments)
            .where(or(...invoiceRows.map((invoice) => eq(payments.invoiceId, invoice.id))))
            .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
        : []

    const redemptionRows = await db
      .select({
        id: voucherRedemptions.id,
        voucherId: voucherRedemptions.voucherId,
        amountCents: voucherRedemptions.amountCents,
        createdAt: voucherRedemptions.createdAt,
        paymentId: voucherRedemptions.paymentId,
        voucherCode: vouchers.code,
        currency: vouchers.currency,
        notes: vouchers.notes,
      })
      .from(voucherRedemptions)
      .innerJoin(vouchers, eq(vouchers.id, voucherRedemptions.voucherId))
      .where(and(eq(voucherRedemptions.bookingId, bookingId), isNull(voucherRedemptions.paymentId)))
      .orderBy(desc(voucherRedemptions.createdAt))

    const paymentProjections = paymentRows.flatMap((payment) => {
      const invoice = invoiceById.get(payment.invoiceId)
      if (!invoice) {
        return []
      }

      return [
        {
          id: payment.id,
          source: "payment" as const,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceType: invoice.invoiceType,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          amountCents: payment.amountCents,
          currency: payment.currency,
          baseCurrency: payment.baseCurrency ?? null,
          baseAmountCents: payment.baseAmountCents ?? null,
          paymentDate: payment.paymentDate,
          referenceNumber: payment.referenceNumber ?? null,
          notes: payment.notes ?? null,
        },
      ]
    })

    const voucherProjections = redemptionRows.map((redemption) => ({
      id: redemption.id,
      source: "voucher_redemption" as const,
      invoiceId: null,
      invoiceNumber: null,
      invoiceType: null,
      status: "completed" as const,
      paymentMethod: "voucher" as const,
      amountCents: redemption.amountCents,
      currency: redemption.currency,
      baseCurrency: null,
      baseAmountCents: null,
      paymentDate:
        redemption.createdAt instanceof Date
          ? redemption.createdAt.toISOString()
          : redemption.createdAt,
      referenceNumber: redemption.voucherCode,
      notes: null,
    }))

    return {
      bookingId,
      payments: [...paymentProjections, ...voucherProjections].sort(
        (a, b) => Date.parse(b.paymentDate) - Date.parse(a.paymentDate),
      ),
    }
  },

  async getPaymentSession(db: PostgresJsDatabase, sessionId: string) {
    const session = await financeService.getPaymentSessionById(db, sessionId)
    return session ? toPublicPaymentSession(session) : null
  },

  async getInvoiceBookingId(db: PostgresJsDatabase, invoiceId: string) {
    const [invoice] = await db
      .select({ bookingId: invoices.bookingId })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    return invoice?.bookingId ?? null
  },

  async startBookingSchedulePaymentSession(
    db: PostgresJsDatabase,
    bookingId: string,
    scheduleId: string,
    input: PublicStartPaymentSessionInput,
  ) {
    const [schedule] = await db
      .select({
        id: bookingPaymentSchedules.id,
      })
      .from(bookingPaymentSchedules)
      .where(
        and(
          eq(bookingPaymentSchedules.id, scheduleId),
          eq(bookingPaymentSchedules.bookingId, bookingId),
        ),
      )
      .limit(1)

    if (!schedule) {
      return null
    }

    const session = await financeService.createPaymentSessionFromBookingSchedule(
      db,
      scheduleId,
      input,
    )
    return session ? toPublicPaymentSession(session) : null
  },

  async startBookingGuaranteePaymentSession(
    db: PostgresJsDatabase,
    bookingId: string,
    guaranteeId: string,
    input: PublicStartPaymentSessionInput,
  ) {
    const [guarantee] = await db
      .select({
        id: bookingGuarantees.id,
      })
      .from(bookingGuarantees)
      .where(and(eq(bookingGuarantees.id, guaranteeId), eq(bookingGuarantees.bookingId, bookingId)))
      .limit(1)

    if (!guarantee) {
      return null
    }

    const session = await financeService.createPaymentSessionFromBookingGuarantee(
      db,
      guaranteeId,
      input,
    )
    return session ? toPublicPaymentSession(session) : null
  },

  async startInvoicePaymentSession(
    db: PostgresJsDatabase,
    invoiceId: string,
    input: PublicStartPaymentSessionInput,
  ) {
    const session = await financeService.createPaymentSessionFromInvoice(db, invoiceId, input)
    return session ? toPublicPaymentSession(session) : null
  },

  async validateVoucher(db: PostgresJsDatabase, input: PublicValidateVoucherInput) {
    const normalizedCode = input.code.trim()
    const normalizedCodeLower = normalizedCode.toLowerCase()

    // New path: first-class `vouchers` table. Covers any voucher issued via
    // POST /v1/finance/vouchers.
    const resolvedFromNewTable = await resolveVoucherFromNewTable(db, normalizedCode)
    if (resolvedFromNewTable) {
      return evaluateVoucherValidity(resolvedFromNewTable, input)
    }

    // Fallback path: legacy payment_instruments rows with instrumentType =
    // 'voucher' and balance carried in metadata JSONB. Kept working until the
    // migration script flips remaining rows over to the new table.
    const voucherConditions = [
      eq(paymentInstruments.instrumentType, "voucher"),
      or(
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`lower(coalesce(${paymentInstruments.externalToken}, '')) = ${normalizedCodeLower}`,
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`lower(coalesce(${paymentInstruments.directBillReference}, '')) = ${normalizedCodeLower}`,
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`lower(coalesce(${paymentInstruments.metadata} ->> 'code', '')) = ${normalizedCodeLower}`,
      ),
    ]

    if (input.provider) {
      voucherConditions.push(eq(paymentInstruments.provider, input.provider))
    }

    const [voucher] = await db
      .select()
      .from(paymentInstruments)
      .where(and(...voucherConditions))
      .orderBy(desc(paymentInstruments.updatedAt))
      .limit(1)

    if (!voucher) {
      return { valid: false as const, reason: "not_found" as const, voucher: null }
    }

    const metadata = getMetadataRecord(voucher.metadata)
    const voucherCode =
      getMetadataString(metadata, "code") ??
      voucher.externalToken ??
      voucher.directBillReference ??
      input.code
    const currency = getMetadataString(metadata, "currency")
    const amountCents = getMetadataNumber(metadata, "amountCents")
    const remainingAmountCents = getMetadataNumber(metadata, "remainingAmountCents") ?? amountCents
    const validFrom = getMetadataString(metadata, "validFrom")
    const expiresAt = getMetadataString(metadata, "expiresAt")
    const bookingIds = getMetadataStringArray(metadata, "bookingIds")
    const bookingId = getMetadataString(metadata, "bookingId")
    const appliesToBookingIds = bookingId ? [bookingId, ...bookingIds] : bookingIds

    return evaluateVoucherValidity(
      {
        id: voucher.id,
        code: voucherCode,
        label: voucher.label,
        provider: voucher.provider ?? null,
        currency,
        amountCents,
        remainingAmountCents,
        validFrom,
        expiresAt,
        appliesToBookingIds,
        status: voucher.status === "active" ? "active" : "inactive",
      },
      input,
    )
  },
}

/**
 * Normalized shape passed into the validity evaluator. Both the new `vouchers`
 * table and the legacy `payment_instruments` path map onto it so the
 * checks (status/expiry/currency/amount/booking) only need to live in one place.
 */
interface ResolvedVoucher {
  id: string
  code: string
  label: string | null
  provider: string | null
  currency: string | null
  amountCents: number | null
  remainingAmountCents: number | null
  validFrom: string | null
  expiresAt: string | null
  appliesToBookingIds: string[]
  /**
   * Collapsed to `active | inactive`. The service's enum has more variants
   * (redeemed / expired / void) but from a validate-for-spend perspective
   * anything non-active should 409 the same way.
   */
  status: "active" | "inactive"
}

async function resolveVoucherFromNewTable(
  db: PostgresJsDatabase,
  code: string,
): Promise<ResolvedVoucher | null> {
  const [row] = await db
    .select()
    .from(vouchers)
    // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    .where(sql`lower(${vouchers.code}) = ${code.toLowerCase()}`)
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    code: row.code,
    label: null,
    provider: null,
    currency: row.currency,
    amountCents: row.initialAmountCents,
    remainingAmountCents: row.remainingAmountCents,
    validFrom: row.validFrom ? row.validFrom.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    appliesToBookingIds: row.sourceBookingId ? [row.sourceBookingId] : [],
    status: row.status === "active" ? "active" : "inactive",
  }
}

function evaluateVoucherValidity(voucher: ResolvedVoucher, input: PublicValidateVoucherInput) {
  const publicVoucher = {
    id: voucher.id,
    code: voucher.code,
    label: voucher.label,
    provider: voucher.provider,
    currency: voucher.currency,
    amountCents: voucher.amountCents,
    remainingAmountCents: voucher.remainingAmountCents,
    expiresAt: voucher.expiresAt,
  }

  if (voucher.status !== "active") {
    return { valid: false as const, reason: "inactive" as const, voucher: publicVoucher }
  }

  if (voucher.validFrom && new Date(voucher.validFrom) > new Date()) {
    return { valid: false as const, reason: "not_started" as const, voucher: publicVoucher }
  }

  if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
    return { valid: false as const, reason: "expired" as const, voucher: publicVoucher }
  }

  if (
    input.bookingId &&
    voucher.appliesToBookingIds.length > 0 &&
    !voucher.appliesToBookingIds.includes(input.bookingId)
  ) {
    return { valid: false as const, reason: "booking_mismatch" as const, voucher: publicVoucher }
  }

  if (input.currency && voucher.currency && input.currency !== voucher.currency) {
    return { valid: false as const, reason: "currency_mismatch" as const, voucher: publicVoucher }
  }

  if (
    input.amountCents &&
    voucher.remainingAmountCents !== null &&
    input.amountCents > voucher.remainingAmountCents
  ) {
    return {
      valid: false as const,
      reason: "insufficient_balance" as const,
      voucher: publicVoucher,
    }
  }

  return { valid: true as const, reason: null, voucher: publicVoucher }
}
