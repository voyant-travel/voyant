import { bookingItems, bookings } from "@voyantjs/bookings/schema"
import type { EventBus } from "@voyantjs/core"
import { renderStructuredTemplate } from "@voyantjs/utils/template-renderer"
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import {
  bookingGuarantees,
  bookingItemCommissions,
  bookingItemTaxLines,
  bookingPaymentSchedules,
  creditNoteLineItems,
  creditNotes,
  financeNotes,
  invoiceExternalRefs,
  invoiceLineItems,
  invoiceNumberSeries,
  invoiceRenditions,
  invoices,
  invoiceTemplates,
  paymentAuthorizations,
  paymentCaptures,
  paymentInstruments,
  paymentSessions,
  payments,
  supplierPayments,
  taxRegimes,
} from "./schema.js"
import { getFinanceAggregates } from "./service-aggregates.js"
import type { InvoiceSettledEvent } from "./service-settlement.js"
import { vouchersService } from "./service-vouchers.js"
import type {
  agingReportQuerySchema,
  applyDefaultBookingPaymentPlanSchema,
  cancelPaymentSessionSchema,
  completePaymentSessionSchema,
  createPaymentSessionFromGuaranteeSchema,
  createPaymentSessionFromInvoiceSchema,
  createPaymentSessionFromScheduleSchema,
  expirePaymentSessionSchema,
  failPaymentSessionSchema,
  insertBookingGuaranteeSchema,
  insertBookingItemCommissionSchema,
  insertBookingItemTaxLineSchema,
  insertBookingPaymentScheduleSchema,
  insertCreditNoteLineItemSchema,
  insertCreditNoteSchema,
  insertFinanceNoteSchema,
  insertInvoiceExternalRefSchema,
  insertInvoiceLineItemSchema,
  insertInvoiceNumberSeriesSchema,
  insertInvoiceRenditionSchema,
  insertInvoiceSchema,
  insertInvoiceTemplateSchema,
  insertPaymentAuthorizationSchema,
  insertPaymentCaptureSchema,
  insertPaymentInstrumentSchema,
  insertPaymentSchema,
  insertPaymentSessionSchema,
  insertSupplierPaymentSchema,
  insertTaxRegimeSchema,
  invoiceFromBookingSchema,
  invoiceListQuerySchema,
  invoiceNumberSeriesListQuerySchema,
  invoiceTemplateListQuerySchema,
  markPaymentSessionRequiresRedirectSchema,
  paymentAuthorizationListQuerySchema,
  paymentCaptureListQuerySchema,
  paymentInstrumentListQuerySchema,
  paymentSessionListQuerySchema,
  profitabilityQuerySchema,
  renderInvoiceInputSchema,
  revenueReportQuerySchema,
  supplierPaymentListQuerySchema,
  taxRegimeListQuerySchema,
  updateBookingGuaranteeSchema,
  updateBookingItemCommissionSchema,
  updateBookingItemTaxLineSchema,
  updateBookingPaymentScheduleSchema,
  updateCreditNoteSchema,
  updateInvoiceLineItemSchema,
  updateInvoiceNumberSeriesSchema,
  updateInvoiceRenditionSchema,
  updateInvoiceSchema,
  updateInvoiceTemplateSchema,
  updatePaymentAuthorizationSchema,
  updatePaymentCaptureSchema,
  updatePaymentInstrumentSchema,
  updatePaymentSessionSchema,
  updateSupplierPaymentSchema,
  updateTaxRegimeSchema,
} from "./validation.js"

type RevenueReportQuery = z.infer<typeof revenueReportQuerySchema>
type AgingReportQuery = z.infer<typeof agingReportQuerySchema>
type ProfitabilityQuery = z.infer<typeof profitabilityQuerySchema>
type PaymentInstrumentListQuery = z.infer<typeof paymentInstrumentListQuerySchema>
type PaymentSessionListQuery = z.infer<typeof paymentSessionListQuerySchema>
type PaymentAuthorizationListQuery = z.infer<typeof paymentAuthorizationListQuerySchema>
type PaymentCaptureListQuery = z.infer<typeof paymentCaptureListQuerySchema>
type CreatePaymentInstrumentInput = z.infer<typeof insertPaymentInstrumentSchema>
type UpdatePaymentInstrumentInput = z.infer<typeof updatePaymentInstrumentSchema>
type CreatePaymentSessionInput = z.infer<typeof insertPaymentSessionSchema>
type UpdatePaymentSessionInput = z.infer<typeof updatePaymentSessionSchema>
type CreatePaymentAuthorizationInput = z.infer<typeof insertPaymentAuthorizationSchema>
type UpdatePaymentAuthorizationInput = z.infer<typeof updatePaymentAuthorizationSchema>
type CreatePaymentCaptureInput = z.infer<typeof insertPaymentCaptureSchema>
type UpdatePaymentCaptureInput = z.infer<typeof updatePaymentCaptureSchema>
type CreateBookingPaymentScheduleInput = z.infer<typeof insertBookingPaymentScheduleSchema>
type UpdateBookingPaymentScheduleInput = z.infer<typeof updateBookingPaymentScheduleSchema>
type CreateBookingGuaranteeInput = z.infer<typeof insertBookingGuaranteeSchema>
type UpdateBookingGuaranteeInput = z.infer<typeof updateBookingGuaranteeSchema>
type CreateBookingItemTaxLineInput = z.infer<typeof insertBookingItemTaxLineSchema>
type UpdateBookingItemTaxLineInput = z.infer<typeof updateBookingItemTaxLineSchema>
type CreateBookingItemCommissionInput = z.infer<typeof insertBookingItemCommissionSchema>
type UpdateBookingItemCommissionInput = z.infer<typeof updateBookingItemCommissionSchema>
type SupplierPaymentListQuery = z.infer<typeof supplierPaymentListQuerySchema>
type CreateSupplierPaymentInput = z.infer<typeof insertSupplierPaymentSchema>
type UpdateSupplierPaymentInput = z.infer<typeof updateSupplierPaymentSchema>
type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>
type CreateInvoiceInput = z.infer<typeof insertInvoiceSchema>
export type CreateInvoiceFromBookingInput = z.infer<typeof invoiceFromBookingSchema>
type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
type CreateInvoiceLineItemInput = z.infer<typeof insertInvoiceLineItemSchema>
type UpdateInvoiceLineItemInput = z.infer<typeof updateInvoiceLineItemSchema>
type CreatePaymentInput = z.infer<typeof insertPaymentSchema>
type CreateCreditNoteInput = z.infer<typeof insertCreditNoteSchema>
type UpdateCreditNoteInput = z.infer<typeof updateCreditNoteSchema>
type CreateCreditNoteLineItemInput = z.infer<typeof insertCreditNoteLineItemSchema>
type CreateFinanceNoteInput = z.infer<typeof insertFinanceNoteSchema>
type InvoiceNumberSeriesListQuery = z.infer<typeof invoiceNumberSeriesListQuerySchema>
type CreateInvoiceNumberSeriesInput = z.infer<typeof insertInvoiceNumberSeriesSchema>
type UpdateInvoiceNumberSeriesInput = z.infer<typeof updateInvoiceNumberSeriesSchema>
type InvoiceTemplateListQuery = z.infer<typeof invoiceTemplateListQuerySchema>
type CreateInvoiceTemplateInput = z.infer<typeof insertInvoiceTemplateSchema>
type UpdateInvoiceTemplateInput = z.infer<typeof updateInvoiceTemplateSchema>
type CreateInvoiceRenditionInput = z.infer<typeof insertInvoiceRenditionSchema>
type UpdateInvoiceRenditionInput = z.infer<typeof updateInvoiceRenditionSchema>
type TaxRegimeListQuery = z.infer<typeof taxRegimeListQuerySchema>
type CreateTaxRegimeInput = z.infer<typeof insertTaxRegimeSchema>
type UpdateTaxRegimeInput = z.infer<typeof updateTaxRegimeSchema>
type CreateInvoiceExternalRefInput = z.infer<typeof insertInvoiceExternalRefSchema>
type RenderInvoiceInput = z.infer<typeof renderInvoiceInputSchema>
type MarkPaymentSessionRequiresRedirectInput = z.infer<
  typeof markPaymentSessionRequiresRedirectSchema
>
type CompletePaymentSessionInput = z.infer<typeof completePaymentSessionSchema>
type FailPaymentSessionInput = z.infer<typeof failPaymentSessionSchema>
type CancelPaymentSessionInput = z.infer<typeof cancelPaymentSessionSchema>
type ExpirePaymentSessionInput = z.infer<typeof expirePaymentSessionSchema>
type CreatePaymentSessionFromScheduleInput = z.infer<typeof createPaymentSessionFromScheduleSchema>
type CreatePaymentSessionFromGuaranteeInput = z.infer<
  typeof createPaymentSessionFromGuaranteeSchema
>
type CreatePaymentSessionFromInvoiceInput = z.infer<typeof createPaymentSessionFromInvoiceSchema>
type ApplyDefaultBookingPaymentPlanInput = z.infer<typeof applyDefaultBookingPaymentPlanSchema>

/** Booking data needed for createInvoiceFromBooking — supplied by the caller (template). */
export interface InvoiceFromBookingData {
  booking: {
    id: string
    bookingNumber: string
    personId: string | null
    organizationId: string | null
    sellCurrency: string
    baseCurrency: string | null
    fxRateSetId: string | null
    sellAmountCents: number | null
    baseSellAmountCents: number | null
  }
  items: Array<{
    id: string
    title: string
    quantity: number
    unitSellAmountCents: number | null
    totalSellAmountCents: number | null
  }>
}

function toTimestamp(value?: string | null) {
  return value ? new Date(value) : null
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10)
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function parseDateString(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function derivePaymentSessionTarget(input: CreatePaymentSessionInput | UpdatePaymentSessionInput) {
  if (input.targetType && input.targetType !== "other") {
    return {
      targetType: input.targetType,
      targetId:
        input.targetId ??
        (input.targetType === "booking"
          ? input.bookingId
          : input.targetType === "order"
            ? input.orderId
            : input.targetType === "invoice"
              ? input.invoiceId
              : input.targetType === "booking_payment_schedule"
                ? input.bookingPaymentScheduleId
                : input.targetType === "booking_guarantee"
                  ? input.bookingGuaranteeId
                  : input.targetId),
    }
  }

  if (input.bookingPaymentScheduleId) {
    return {
      targetType: "booking_payment_schedule" as const,
      targetId: input.bookingPaymentScheduleId,
    }
  }
  if (input.bookingGuaranteeId) {
    return { targetType: "booking_guarantee" as const, targetId: input.bookingGuaranteeId }
  }
  if (input.invoiceId) {
    return { targetType: "invoice" as const, targetId: input.invoiceId }
  }
  if (input.orderId) {
    return { targetType: "order" as const, targetId: input.orderId }
  }
  if (input.bookingId) {
    return { targetType: "booking" as const, targetId: input.bookingId }
  }

  return {
    targetType: (input.targetType ?? "other") as CreatePaymentSessionInput["targetType"],
    targetId: input.targetId ?? null,
  }
}

// ============================================================================
// Invoice number allocation (transactional)
// ============================================================================

function currentPeriodBoundary(strategy: "never" | "annual" | "monthly", now: Date): Date | null {
  if (strategy === "never") return null
  if (strategy === "annual") {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  }
  // monthly
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function formatNumber(
  prefix: string,
  separator: string,
  padLength: number,
  sequence: number,
): string {
  const padded = String(sequence).padStart(padLength, "0")
  return `${prefix}${separator}${padded}`
}

export function renderInvoiceBody(
  body: string,
  bodyFormat: "html" | "markdown" | "lexical_json",
  variables: Record<string, unknown>,
): string {
  return renderStructuredTemplate(body, bodyFormat, variables)
}

async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ total: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.total ?? 0, limit, offset }
}

/**
 * Runtime context for finance service methods that need to emit lifecycle
 * events (e.g. `invoice.settled`). Optional — methods fall back to a no-op
 * when no eventBus is provided, so direct callers (tests, scripts) don't
 * have to wire one up.
 */
export interface FinanceServiceRuntime {
  eventBus?: EventBus
}

export const financeService = {
  vouchers: vouchersService,
  getFinanceAggregates,

  async listPaymentInstruments(db: PostgresJsDatabase, query: PaymentInstrumentListQuery) {
    const conditions = []
    if (query.ownerType) conditions.push(eq(paymentInstruments.ownerType, query.ownerType))
    if (query.personId) conditions.push(eq(paymentInstruments.personId, query.personId))
    if (query.organizationId)
      conditions.push(eq(paymentInstruments.organizationId, query.organizationId))
    if (query.supplierId) conditions.push(eq(paymentInstruments.supplierId, query.supplierId))
    if (query.channelId) conditions.push(eq(paymentInstruments.channelId, query.channelId))
    if (query.status) conditions.push(eq(paymentInstruments.status, query.status))
    if (query.instrumentType)
      conditions.push(eq(paymentInstruments.instrumentType, query.instrumentType))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(
        or(ilike(paymentInstruments.label, term), ilike(paymentInstruments.provider, term)),
      )
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(paymentInstruments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(paymentInstruments.updatedAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(paymentInstruments).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPaymentInstrumentById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(paymentInstruments)
      .where(eq(paymentInstruments.id, id))
      .limit(1)
    return row ?? null
  },

  async createPaymentInstrument(db: PostgresJsDatabase, data: CreatePaymentInstrumentInput) {
    const [row] = await db.insert(paymentInstruments).values(data).returning()
    return row ?? null
  },

  async updatePaymentInstrument(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentInstrumentInput,
  ) {
    const [row] = await db
      .update(paymentInstruments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(paymentInstruments.id, id))
      .returning()
    return row ?? null
  },

  async deletePaymentInstrument(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(paymentInstruments)
      .where(eq(paymentInstruments.id, id))
      .returning({ id: paymentInstruments.id })
    return row ?? null
  },

  async listPaymentSessions(db: PostgresJsDatabase, query: PaymentSessionListQuery) {
    const conditions = []
    if (query.bookingId) conditions.push(eq(paymentSessions.bookingId, query.bookingId))
    if (query.orderId) conditions.push(eq(paymentSessions.orderId, query.orderId))
    if (query.invoiceId) conditions.push(eq(paymentSessions.invoiceId, query.invoiceId))
    if (query.bookingPaymentScheduleId) {
      conditions.push(eq(paymentSessions.bookingPaymentScheduleId, query.bookingPaymentScheduleId))
    }
    if (query.bookingGuaranteeId) {
      conditions.push(eq(paymentSessions.bookingGuaranteeId, query.bookingGuaranteeId))
    }
    if (query.targetType) conditions.push(eq(paymentSessions.targetType, query.targetType))
    if (query.status) conditions.push(eq(paymentSessions.status, query.status))
    if (query.provider) conditions.push(eq(paymentSessions.provider, query.provider))
    if (query.providerSessionId) {
      conditions.push(eq(paymentSessions.providerSessionId, query.providerSessionId))
    }
    if (query.providerPaymentId) {
      conditions.push(eq(paymentSessions.providerPaymentId, query.providerPaymentId))
    }
    if (query.externalReference) {
      conditions.push(eq(paymentSessions.externalReference, query.externalReference))
    }
    if (query.clientReference) {
      conditions.push(eq(paymentSessions.clientReference, query.clientReference))
    }
    if (query.idempotencyKey) {
      conditions.push(eq(paymentSessions.idempotencyKey, query.idempotencyKey))
    }

    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(paymentSessions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(paymentSessions.createdAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(paymentSessions).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPaymentSessionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(paymentSessions).where(eq(paymentSessions.id, id)).limit(1)
    return row ?? null
  },

  async createPaymentSession(db: PostgresJsDatabase, data: CreatePaymentSessionInput) {
    if (data.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(paymentSessions)
        .where(eq(paymentSessions.idempotencyKey, data.idempotencyKey))
        .limit(1)

      if (existing) {
        return existing
      }
    }

    const target = derivePaymentSessionTarget(data)
    const [row] = await db
      .insert(paymentSessions)
      .values({
        ...data,
        ...target,
        paymentInstrumentId: data.paymentInstrumentId ?? null,
        paymentAuthorizationId: data.paymentAuthorizationId ?? null,
        paymentCaptureId: data.paymentCaptureId ?? null,
        paymentId: data.paymentId ?? null,
        completedAt: toTimestamp(data.completedAt),
        failedAt: toTimestamp(data.failedAt),
        cancelledAt: toTimestamp(data.cancelledAt),
        expiredAt: toTimestamp(data.expiredAt),
        expiresAt: toTimestamp(data.expiresAt),
      })
      .returning()

    return row ?? null
  },

  async updatePaymentSession(db: PostgresJsDatabase, id: string, data: UpdatePaymentSessionInput) {
    const target = derivePaymentSessionTarget(data)
    const [row] = await db
      .update(paymentSessions)
      .set({
        ...data,
        ...target,
        paymentInstrumentId:
          data.paymentInstrumentId === undefined ? undefined : (data.paymentInstrumentId ?? null),
        paymentAuthorizationId:
          data.paymentAuthorizationId === undefined
            ? undefined
            : (data.paymentAuthorizationId ?? null),
        paymentCaptureId:
          data.paymentCaptureId === undefined ? undefined : (data.paymentCaptureId ?? null),
        paymentId: data.paymentId === undefined ? undefined : (data.paymentId ?? null),
        completedAt: data.completedAt === undefined ? undefined : toTimestamp(data.completedAt),
        failedAt: data.failedAt === undefined ? undefined : toTimestamp(data.failedAt),
        cancelledAt: data.cancelledAt === undefined ? undefined : toTimestamp(data.cancelledAt),
        expiredAt: data.expiredAt === undefined ? undefined : toTimestamp(data.expiredAt),
        expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, id))
      .returning()

    return row ?? null
  },

  async markPaymentSessionRequiresRedirect(
    db: PostgresJsDatabase,
    id: string,
    data: MarkPaymentSessionRequiresRedirectInput,
  ) {
    const [row] = await db
      .update(paymentSessions)
      .set({
        status: "requires_redirect",
        provider: data.provider ?? undefined,
        providerSessionId: data.providerSessionId ?? undefined,
        providerPaymentId: data.providerPaymentId ?? undefined,
        externalReference: data.externalReference ?? undefined,
        redirectUrl: data.redirectUrl,
        returnUrl: data.returnUrl ?? undefined,
        cancelUrl: data.cancelUrl ?? undefined,
        callbackUrl: data.callbackUrl ?? undefined,
        expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
        providerPayload: data.providerPayload ?? undefined,
        metadata: data.metadata ?? undefined,
        notes: data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, id))
      .returning()

    return row ?? null
  },

  async failPaymentSession(db: PostgresJsDatabase, id: string, data: FailPaymentSessionInput) {
    const [row] = await db
      .update(paymentSessions)
      .set({
        status: "failed",
        providerSessionId: data.providerSessionId ?? undefined,
        providerPaymentId: data.providerPaymentId ?? undefined,
        externalReference: data.externalReference ?? undefined,
        failureCode: data.failureCode ?? undefined,
        failureMessage: data.failureMessage ?? undefined,
        failedAt: new Date(),
        providerPayload: data.providerPayload ?? undefined,
        metadata: data.metadata ?? undefined,
        notes: data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, id))
      .returning()

    return row ?? null
  },

  async cancelPaymentSession(db: PostgresJsDatabase, id: string, data: CancelPaymentSessionInput) {
    const [row] = await db
      .update(paymentSessions)
      .set({
        status: "cancelled",
        cancelledAt: data.cancelledAt ? toTimestamp(data.cancelledAt) : new Date(),
        providerPayload: data.providerPayload ?? undefined,
        metadata: data.metadata ?? undefined,
        notes: data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, id))
      .returning()

    return row ?? null
  },

  async expirePaymentSession(db: PostgresJsDatabase, id: string, data: ExpirePaymentSessionInput) {
    const [row] = await db
      .update(paymentSessions)
      .set({
        status: "expired",
        expiredAt: data.expiredAt ? toTimestamp(data.expiredAt) : new Date(),
        providerPayload: data.providerPayload ?? undefined,
        metadata: data.metadata ?? undefined,
        notes: data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, id))
      .returning()

    return row ?? null
  },

  async completePaymentSession(
    db: PostgresJsDatabase,
    id: string,
    data: CompletePaymentSessionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [session] = await db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, id))
      .limit(1)

    if (!session) {
      return null
    }

    const txResult = await db.transaction(async (tx) => {
      let authorizationId = session.paymentAuthorizationId
      let captureId = session.paymentCaptureId
      let paymentId = session.paymentId
      // Settlement payload to emit after the tx commits, so subscribers see
      // a consistent post-update view. Stays null when this call doesn't
      // result in a new payment being applied to an invoice.
      let settlementForEmit: InvoiceSettledEvent | null = null

      if (!authorizationId) {
        const [authorization] = await tx
          .insert(paymentAuthorizations)
          .values({
            bookingId: session.bookingId ?? null,
            orderId: session.orderId ?? null,
            invoiceId: session.invoiceId ?? null,
            bookingGuaranteeId: session.bookingGuaranteeId ?? null,
            paymentInstrumentId: data.paymentInstrumentId ?? session.paymentInstrumentId ?? null,
            status: data.status === "paid" ? "captured" : "authorized",
            captureMode: data.captureMode,
            currency: session.currency,
            amountCents: session.amountCents,
            provider: session.provider ?? null,
            externalAuthorizationId:
              data.externalAuthorizationId ??
              data.providerPaymentId ??
              session.providerPaymentId ??
              null,
            approvalCode: data.approvalCode ?? null,
            authorizedAt: toTimestamp(data.authorizedAt) ?? new Date(),
            expiresAt: toTimestamp(data.expiresAt),
            notes: data.notes ?? session.notes ?? null,
          })
          .returning({ id: paymentAuthorizations.id })

        authorizationId = authorization?.id ?? null
      } else if (data.status === "paid") {
        await tx
          .update(paymentAuthorizations)
          .set({
            status: "captured",
            paymentInstrumentId:
              data.paymentInstrumentId ?? session.paymentInstrumentId ?? undefined,
            externalAuthorizationId:
              data.externalAuthorizationId === undefined
                ? undefined
                : (data.externalAuthorizationId ?? null),
            approvalCode: data.approvalCode ?? undefined,
            authorizedAt:
              data.authorizedAt === undefined ? undefined : toTimestamp(data.authorizedAt),
            expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
            updatedAt: new Date(),
          })
          .where(eq(paymentAuthorizations.id, authorizationId))
      }

      if (data.status === "paid" && !captureId) {
        const [capture] = await tx
          .insert(paymentCaptures)
          .values({
            paymentAuthorizationId: authorizationId,
            invoiceId: session.invoiceId ?? null,
            status: "completed",
            currency: session.currency,
            amountCents: session.amountCents,
            provider: session.provider ?? null,
            externalCaptureId:
              data.externalCaptureId ?? data.providerPaymentId ?? session.providerPaymentId ?? null,
            capturedAt: toTimestamp(data.capturedAt) ?? new Date(),
            settledAt: toTimestamp(data.settledAt),
            notes: data.notes ?? session.notes ?? null,
          })
          .returning({ id: paymentCaptures.id })

        captureId = capture?.id ?? null
      }

      if (data.status === "paid" && session.invoiceId && !paymentId) {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, session.invoiceId))
          .limit(1)

        if (invoice) {
          const [payment] = await tx
            .insert(payments)
            .values({
              invoiceId: session.invoiceId,
              amountCents: session.amountCents,
              currency: session.currency,
              paymentMethod: data.paymentMethod ?? session.paymentMethod ?? "other",
              paymentInstrumentId: data.paymentInstrumentId ?? session.paymentInstrumentId ?? null,
              paymentAuthorizationId: authorizationId,
              paymentCaptureId: captureId,
              status: "completed",
              referenceNumber:
                data.referenceNumber ?? data.externalReference ?? session.externalReference ?? null,
              paymentDate: (data.paymentDate ? new Date(data.paymentDate) : new Date())
                .toISOString()
                .slice(0, 10),
              notes: data.notes ?? session.notes ?? null,
            })
            .returning({ id: payments.id })

          paymentId = payment?.id ?? null

          const [sumResult] = await tx
            .select({ total: sql<number>`coalesce(sum(amount_cents), 0)::int` })
            .from(payments)
            .where(and(eq(payments.invoiceId, session.invoiceId), eq(payments.status, "completed")))

          const paidCents = sumResult?.total ?? 0
          const balanceDueCents = Math.max(0, invoice.totalCents - paidCents)

          await tx
            .update(invoices)
            .set({
              paidCents,
              balanceDueCents,
              status:
                paidCents >= invoice.totalCents
                  ? "paid"
                  : paidCents > 0
                    ? "partially_paid"
                    : invoice.status,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, session.invoiceId))

          if (paymentId) {
            settlementForEmit = {
              invoiceId: session.invoiceId,
              paymentId,
              provider: session.provider ?? "internal",
              newlyAppliedAmountCents: session.amountCents,
              paidCents,
              balanceDueCents,
            }
          }
        }
      }

      if (data.status === "paid" && session.bookingPaymentScheduleId) {
        await tx
          .update(bookingPaymentSchedules)
          .set({ status: "paid", updatedAt: new Date() })
          .where(eq(bookingPaymentSchedules.id, session.bookingPaymentScheduleId))
      }

      if (session.bookingGuaranteeId && authorizationId) {
        await tx
          .update(bookingGuarantees)
          .set({
            paymentAuthorizationId: authorizationId,
            paymentInstrumentId:
              data.paymentInstrumentId ?? session.paymentInstrumentId ?? undefined,
            status: "active",
            guaranteedAt: toTimestamp(data.authorizedAt) ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookingGuarantees.id, session.bookingGuaranteeId))
      }

      const [updated] = await tx
        .update(paymentSessions)
        .set({
          status: data.status,
          paymentMethod: data.paymentMethod ?? session.paymentMethod ?? undefined,
          paymentInstrumentId: data.paymentInstrumentId ?? session.paymentInstrumentId ?? undefined,
          paymentAuthorizationId: authorizationId,
          paymentCaptureId: captureId,
          paymentId,
          providerSessionId: data.providerSessionId ?? session.providerSessionId ?? undefined,
          providerPaymentId: data.providerPaymentId ?? session.providerPaymentId ?? undefined,
          externalReference: data.externalReference ?? session.externalReference ?? undefined,
          providerPayload: data.providerPayload ?? undefined,
          metadata: data.metadata ?? undefined,
          notes: data.notes ?? session.notes ?? undefined,
          redirectUrl: data.status === "paid" ? null : session.redirectUrl,
          failureCode: null,
          failureMessage: null,
          expiresAt: data.expiresAt === undefined ? session.expiresAt : toTimestamp(data.expiresAt),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentSessions.id, id))
        .returning()

      return { updated: updated ?? null, settlement: settlementForEmit }
    })

    if (txResult.settlement) {
      await runtime.eventBus?.emit("invoice.settled", txResult.settlement, {
        category: "domain",
        source: "service",
      })
    }

    return txResult.updated
  },

  async listPaymentAuthorizations(db: PostgresJsDatabase, query: PaymentAuthorizationListQuery) {
    const conditions = []
    if (query.bookingId) conditions.push(eq(paymentAuthorizations.bookingId, query.bookingId))
    if (query.orderId) conditions.push(eq(paymentAuthorizations.orderId, query.orderId))
    if (query.invoiceId) conditions.push(eq(paymentAuthorizations.invoiceId, query.invoiceId))
    if (query.bookingGuaranteeId)
      conditions.push(eq(paymentAuthorizations.bookingGuaranteeId, query.bookingGuaranteeId))
    if (query.paymentInstrumentId)
      conditions.push(eq(paymentAuthorizations.paymentInstrumentId, query.paymentInstrumentId))
    if (query.status) conditions.push(eq(paymentAuthorizations.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(paymentAuthorizations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(paymentAuthorizations.createdAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(paymentAuthorizations).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPaymentAuthorizationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(paymentAuthorizations)
      .where(eq(paymentAuthorizations.id, id))
      .limit(1)
    return row ?? null
  },

  async createPaymentAuthorization(db: PostgresJsDatabase, data: CreatePaymentAuthorizationInput) {
    const [row] = await db
      .insert(paymentAuthorizations)
      .values({
        ...data,
        authorizedAt: toTimestamp(data.authorizedAt),
        expiresAt: toTimestamp(data.expiresAt),
        voidedAt: toTimestamp(data.voidedAt),
      })
      .returning()
    return row ?? null
  },

  async updatePaymentAuthorization(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentAuthorizationInput,
  ) {
    const [row] = await db
      .update(paymentAuthorizations)
      .set({
        ...data,
        authorizedAt: data.authorizedAt === undefined ? undefined : toTimestamp(data.authorizedAt),
        expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
        voidedAt: data.voidedAt === undefined ? undefined : toTimestamp(data.voidedAt),
        updatedAt: new Date(),
      })
      .where(eq(paymentAuthorizations.id, id))
      .returning()
    return row ?? null
  },

  async deletePaymentAuthorization(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(paymentAuthorizations)
      .where(eq(paymentAuthorizations.id, id))
      .returning({ id: paymentAuthorizations.id })
    return row ?? null
  },

  async listPaymentCaptures(db: PostgresJsDatabase, query: PaymentCaptureListQuery) {
    const conditions = []
    if (query.paymentAuthorizationId)
      conditions.push(eq(paymentCaptures.paymentAuthorizationId, query.paymentAuthorizationId))
    if (query.invoiceId) conditions.push(eq(paymentCaptures.invoiceId, query.invoiceId))
    if (query.status) conditions.push(eq(paymentCaptures.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(paymentCaptures)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(paymentCaptures.createdAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(paymentCaptures).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPaymentCaptureById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(paymentCaptures).where(eq(paymentCaptures.id, id)).limit(1)
    return row ?? null
  },

  async createPaymentCapture(db: PostgresJsDatabase, data: CreatePaymentCaptureInput) {
    const [row] = await db
      .insert(paymentCaptures)
      .values({
        ...data,
        capturedAt: toTimestamp(data.capturedAt),
        settledAt: toTimestamp(data.settledAt),
      })
      .returning()
    return row ?? null
  },

  async updatePaymentCapture(db: PostgresJsDatabase, id: string, data: UpdatePaymentCaptureInput) {
    const [row] = await db
      .update(paymentCaptures)
      .set({
        ...data,
        capturedAt: data.capturedAt === undefined ? undefined : toTimestamp(data.capturedAt),
        settledAt: data.settledAt === undefined ? undefined : toTimestamp(data.settledAt),
        updatedAt: new Date(),
      })
      .where(eq(paymentCaptures.id, id))
      .returning()
    return row ?? null
  },

  async deletePaymentCapture(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(paymentCaptures)
      .where(eq(paymentCaptures.id, id))
      .returning({ id: paymentCaptures.id })
    return row ?? null
  },

  listBookingPaymentSchedules(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingPaymentSchedules)
      .where(eq(bookingPaymentSchedules.bookingId, bookingId))
      .orderBy(asc(bookingPaymentSchedules.dueDate), asc(bookingPaymentSchedules.createdAt))
  },

  async createBookingPaymentSchedule(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateBookingPaymentScheduleInput,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const [row] = await db
      .insert(bookingPaymentSchedules)
      .values({ ...data, bookingId })
      .returning()

    return row ?? null
  },

  async applyDefaultBookingPaymentPlan(
    db: PostgresJsDatabase,
    bookingId: string,
    data: ApplyDefaultBookingPaymentPlanInput,
  ) {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)

    if (!booking) {
      return null
    }

    const totalAmountCents = booking.sellAmountCents ?? 0
    if (totalAmountCents <= 0) {
      return []
    }

    const today = startOfUtcDay(new Date())
    const depositDueDate = data.depositDueDate ? parseDateString(data.depositDueDate) : today
    const startDate = booking.startDate ? parseDateString(booking.startDate) : null
    const rawBalanceDueDate = startDate
      ? new Date(startDate.getTime() - data.balanceDueDaysBeforeStart * 24 * 60 * 60 * 1000)
      : today
    const balanceDueDate = rawBalanceDueDate < today ? today : rawBalanceDueDate

    let depositAmountCents = 0
    if (data.depositMode === "fixed_amount") {
      depositAmountCents = Math.min(totalAmountCents, data.depositValue)
    } else if (data.depositMode === "percentage") {
      depositAmountCents = Math.min(
        totalAmountCents,
        Math.round((totalAmountCents * data.depositValue) / 100),
      )
    }

    if (data.clearExistingPending) {
      await db
        .delete(bookingPaymentSchedules)
        .where(
          and(
            eq(bookingPaymentSchedules.bookingId, bookingId),
            or(
              eq(bookingPaymentSchedules.status, "pending"),
              eq(bookingPaymentSchedules.status, "due"),
            ),
          ),
        )
    }

    const scheduleRows: CreateBookingPaymentScheduleInput[] = []
    if (depositAmountCents > 0 && depositAmountCents < totalAmountCents) {
      scheduleRows.push({
        bookingItemId: null,
        scheduleType: "deposit",
        status: depositDueDate <= today ? "due" : "pending",
        dueDate: toDateString(depositDueDate),
        currency: booking.sellCurrency,
        amountCents: depositAmountCents,
        notes: data.notes ?? null,
      })
      scheduleRows.push({
        bookingItemId: null,
        scheduleType: "balance",
        status: balanceDueDate <= today ? "due" : "pending",
        dueDate: toDateString(balanceDueDate),
        currency: booking.sellCurrency,
        amountCents: Math.max(0, totalAmountCents - depositAmountCents),
        notes: data.notes ?? null,
      })
    } else {
      const singleDueDate = balanceDueDate <= today ? today : balanceDueDate
      scheduleRows.push({
        bookingItemId: null,
        scheduleType: "balance",
        status: singleDueDate <= today ? "due" : "pending",
        dueDate: toDateString(singleDueDate),
        currency: booking.sellCurrency,
        amountCents: totalAmountCents,
        notes: data.notes ?? null,
      })
    }

    const createdSchedules = await db
      .insert(bookingPaymentSchedules)
      .values(
        scheduleRows.map((row) => ({
          ...row,
          bookingId,
          bookingItemId: row.bookingItemId ?? null,
          notes: row.notes ?? null,
        })),
      )
      .returning()

    if (data.createGuarantee) {
      const depositSchedule = createdSchedules.find(
        (schedule) => schedule.scheduleType === "deposit",
      )
      if (depositSchedule) {
        await db.insert(bookingGuarantees).values({
          bookingId,
          bookingPaymentScheduleId: depositSchedule.id,
          bookingItemId: null,
          guaranteeType: data.guaranteeType,
          status: "pending",
          paymentInstrumentId: null,
          paymentAuthorizationId: null,
          currency: depositSchedule.currency,
          amountCents: depositSchedule.amountCents,
          provider: null,
          referenceNumber: null,
          guaranteedAt: null,
          expiresAt: null,
          releasedAt: null,
          notes: data.notes ?? null,
        })
      }
    }

    return createdSchedules
  },

  async updateBookingPaymentSchedule(
    db: PostgresJsDatabase,
    scheduleId: string,
    data: UpdateBookingPaymentScheduleInput,
  ) {
    const [row] = await db
      .update(bookingPaymentSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookingPaymentSchedules.id, scheduleId))
      .returning()

    return row ?? null
  },

  async deleteBookingPaymentSchedule(db: PostgresJsDatabase, scheduleId: string) {
    const [row] = await db
      .delete(bookingPaymentSchedules)
      .where(eq(bookingPaymentSchedules.id, scheduleId))
      .returning({ id: bookingPaymentSchedules.id })

    return row ?? null
  },

  async createPaymentSessionFromBookingSchedule(
    db: PostgresJsDatabase,
    scheduleId: string,
    data: CreatePaymentSessionFromScheduleInput,
  ) {
    const [schedule] = await db
      .select()
      .from(bookingPaymentSchedules)
      .where(eq(bookingPaymentSchedules.id, scheduleId))
      .limit(1)

    if (!schedule) {
      return null
    }

    if (
      schedule.status === "paid" ||
      schedule.status === "waived" ||
      schedule.status === "cancelled"
    ) {
      throw new Error(`Cannot create payment session for schedule in status "${schedule.status}"`)
    }

    return this.createPaymentSession(db, {
      targetType: "booking_payment_schedule",
      targetId: schedule.id,
      bookingId: schedule.bookingId,
      bookingPaymentScheduleId: schedule.id,
      status: "pending",
      provider: data.provider ?? null,
      externalReference: data.externalReference ?? null,
      idempotencyKey: data.idempotencyKey ?? null,
      clientReference: data.clientReference ?? schedule.id,
      currency: schedule.currency,
      amountCents: schedule.amountCents,
      paymentMethod: data.paymentMethod ?? null,
      payerPersonId: data.payerPersonId ?? null,
      payerOrganizationId: data.payerOrganizationId ?? null,
      payerEmail: data.payerEmail ?? null,
      payerName: data.payerName ?? null,
      returnUrl: data.returnUrl ?? null,
      cancelUrl: data.cancelUrl ?? null,
      callbackUrl: data.callbackUrl ?? null,
      expiresAt: data.expiresAt ?? null,
      notes: data.notes ?? schedule.notes ?? null,
      providerPayload: data.providerPayload ?? null,
      metadata: data.metadata ?? {
        scheduleType: schedule.scheduleType,
        dueDate: schedule.dueDate,
      },
    })
  },

  async createPaymentSessionFromInvoice(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreatePaymentSessionFromInvoiceInput,
  ) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)

    if (!invoice) {
      return null
    }

    if (invoice.status === "paid" || invoice.status === "void") {
      throw new Error(`Cannot create payment session for invoice in status "${invoice.status}"`)
    }

    if (invoice.balanceDueCents <= 0) {
      throw new Error("Invoice must have an outstanding balance before creating a payment session")
    }

    return this.createPaymentSession(db, {
      targetType: "invoice",
      targetId: invoice.id,
      bookingId: invoice.bookingId,
      invoiceId: invoice.id,
      status: "pending",
      provider: data.provider ?? null,
      externalReference: data.externalReference ?? invoice.invoiceNumber,
      idempotencyKey: data.idempotencyKey ?? null,
      clientReference: data.clientReference ?? invoice.id,
      currency: invoice.currency,
      amountCents: invoice.balanceDueCents,
      paymentMethod: data.paymentMethod ?? null,
      payerPersonId: data.payerPersonId ?? invoice.personId ?? null,
      payerOrganizationId: data.payerOrganizationId ?? invoice.organizationId ?? null,
      payerEmail: data.payerEmail ?? null,
      payerName: data.payerName ?? null,
      returnUrl: data.returnUrl ?? null,
      cancelUrl: data.cancelUrl ?? null,
      callbackUrl: data.callbackUrl ?? null,
      expiresAt: data.expiresAt ?? null,
      notes: data.notes ?? invoice.notes ?? null,
      providerPayload: data.providerPayload ?? null,
      metadata: data.metadata ?? {
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        dueDate: invoice.dueDate,
      },
    })
  },

  listBookingGuarantees(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingGuarantees)
      .where(eq(bookingGuarantees.bookingId, bookingId))
      .orderBy(desc(bookingGuarantees.createdAt))
  },

  async createBookingGuarantee(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateBookingGuaranteeInput,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const [row] = await db
      .insert(bookingGuarantees)
      .values({
        bookingId,
        bookingPaymentScheduleId: data.bookingPaymentScheduleId ?? null,
        bookingItemId: data.bookingItemId ?? null,
        guaranteeType: data.guaranteeType,
        status: data.status,
        paymentInstrumentId: data.paymentInstrumentId ?? null,
        paymentAuthorizationId: data.paymentAuthorizationId ?? null,
        currency: data.currency ?? null,
        amountCents: data.amountCents ?? null,
        provider: data.provider ?? null,
        referenceNumber: data.referenceNumber ?? null,
        guaranteedAt: toTimestamp(data.guaranteedAt),
        expiresAt: toTimestamp(data.expiresAt),
        releasedAt: toTimestamp(data.releasedAt),
        notes: data.notes ?? null,
      })
      .returning()

    return row ?? null
  },

  async createPaymentSessionFromBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    data: CreatePaymentSessionFromGuaranteeInput,
  ) {
    const [guarantee] = await db
      .select()
      .from(bookingGuarantees)
      .where(eq(bookingGuarantees.id, guaranteeId))
      .limit(1)

    if (!guarantee) {
      return null
    }

    if (
      guarantee.status === "active" ||
      guarantee.status === "released" ||
      guarantee.status === "cancelled"
    ) {
      throw new Error(`Cannot create payment session for guarantee in status "${guarantee.status}"`)
    }

    const currency = guarantee.currency
    const amountCents = guarantee.amountCents
    if (!currency || amountCents === null || amountCents === undefined || amountCents <= 0) {
      throw new Error(
        "Booking guarantee must have currency and amount before creating a payment session",
      )
    }

    return this.createPaymentSession(db, {
      targetType: "booking_guarantee",
      targetId: guarantee.id,
      bookingId: guarantee.bookingId,
      bookingGuaranteeId: guarantee.id,
      paymentInstrumentId: guarantee.paymentInstrumentId ?? null,
      paymentAuthorizationId: guarantee.paymentAuthorizationId ?? null,
      status: "pending",
      provider: data.provider ?? guarantee.provider ?? null,
      externalReference: data.externalReference ?? guarantee.referenceNumber ?? null,
      idempotencyKey: data.idempotencyKey ?? null,
      clientReference: data.clientReference ?? guarantee.id,
      currency,
      amountCents,
      paymentMethod: data.paymentMethod ?? null,
      payerPersonId: data.payerPersonId ?? null,
      payerOrganizationId: data.payerOrganizationId ?? null,
      payerEmail: data.payerEmail ?? null,
      payerName: data.payerName ?? null,
      returnUrl: data.returnUrl ?? null,
      cancelUrl: data.cancelUrl ?? null,
      callbackUrl: data.callbackUrl ?? null,
      expiresAt: data.expiresAt ?? null,
      notes: data.notes ?? guarantee.notes ?? null,
      providerPayload: data.providerPayload ?? null,
      metadata: data.metadata ?? {
        guaranteeType: guarantee.guaranteeType,
      },
    })
  },

  async updateBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    data: UpdateBookingGuaranteeInput,
  ) {
    const [row] = await db
      .update(bookingGuarantees)
      .set({
        ...data,
        guaranteedAt: data.guaranteedAt === undefined ? undefined : toTimestamp(data.guaranteedAt),
        expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
        releasedAt: data.releasedAt === undefined ? undefined : toTimestamp(data.releasedAt),
        updatedAt: new Date(),
      })
      .where(eq(bookingGuarantees.id, guaranteeId))
      .returning()

    return row ?? null
  },

  async deleteBookingGuarantee(db: PostgresJsDatabase, guaranteeId: string) {
    const [row] = await db
      .delete(bookingGuarantees)
      .where(eq(bookingGuarantees.id, guaranteeId))
      .returning({ id: bookingGuarantees.id })

    return row ?? null
  },

  listBookingItemTaxLines(db: PostgresJsDatabase, bookingItemId: string) {
    return db
      .select()
      .from(bookingItemTaxLines)
      .where(eq(bookingItemTaxLines.bookingItemId, bookingItemId))
      .orderBy(asc(bookingItemTaxLines.sortOrder), asc(bookingItemTaxLines.createdAt))
  },

  async createBookingItemTaxLine(
    db: PostgresJsDatabase,
    bookingItemId: string,
    data: CreateBookingItemTaxLineInput,
  ) {
    const [bookingItem] = await db
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .where(eq(bookingItems.id, bookingItemId))
      .limit(1)

    if (!bookingItem) {
      return null
    }

    const [row] = await db
      .insert(bookingItemTaxLines)
      .values({ ...data, bookingItemId })
      .returning()

    return row ?? null
  },

  async updateBookingItemTaxLine(
    db: PostgresJsDatabase,
    taxLineId: string,
    data: UpdateBookingItemTaxLineInput,
  ) {
    const [row] = await db
      .update(bookingItemTaxLines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookingItemTaxLines.id, taxLineId))
      .returning()

    return row ?? null
  },

  async deleteBookingItemTaxLine(db: PostgresJsDatabase, taxLineId: string) {
    const [row] = await db
      .delete(bookingItemTaxLines)
      .where(eq(bookingItemTaxLines.id, taxLineId))
      .returning({ id: bookingItemTaxLines.id })

    return row ?? null
  },

  listBookingItemCommissions(db: PostgresJsDatabase, bookingItemId: string) {
    return db
      .select()
      .from(bookingItemCommissions)
      .where(eq(bookingItemCommissions.bookingItemId, bookingItemId))
      .orderBy(desc(bookingItemCommissions.createdAt))
  },

  async createBookingItemCommission(
    db: PostgresJsDatabase,
    bookingItemId: string,
    data: CreateBookingItemCommissionInput,
  ) {
    const [bookingItem] = await db
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .where(eq(bookingItems.id, bookingItemId))
      .limit(1)

    if (!bookingItem) {
      return null
    }

    const [row] = await db
      .insert(bookingItemCommissions)
      .values({ ...data, bookingItemId })
      .returning()

    return row ?? null
  },

  async updateBookingItemCommission(
    db: PostgresJsDatabase,
    commissionId: string,
    data: UpdateBookingItemCommissionInput,
  ) {
    const [row] = await db
      .update(bookingItemCommissions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookingItemCommissions.id, commissionId))
      .returning()

    return row ?? null
  },

  async deleteBookingItemCommission(db: PostgresJsDatabase, commissionId: string) {
    const [row] = await db
      .delete(bookingItemCommissions)
      .where(eq(bookingItemCommissions.id, commissionId))
      .returning({ id: bookingItemCommissions.id })

    return row ?? null
  },

  getRevenueReport(db: PostgresJsDatabase, query: RevenueReportQuery) {
    return db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${invoices.issueDate}::date), 'YYYY-MM')`,
        totalCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(and(gte(invoices.issueDate, query.from), lte(invoices.issueDate, query.to)))
      .groupBy(sql`date_trunc('month', ${invoices.issueDate}::date)`)
      .orderBy(sql`date_trunc('month', ${invoices.issueDate}::date)`)
  },

  getAgingReport(db: PostgresJsDatabase, query: AgingReportQuery) {
    const asOf = query.asOf ?? new Date().toISOString().slice(0, 10)

    return db
      .select({
        bucket: sql<string>`
          case
            when ${invoices.dueDate}::date >= ${asOf}::date then 'current'
            when ${asOf}::date - ${invoices.dueDate}::date <= 30 then '1-30'
            when ${asOf}::date - ${invoices.dueDate}::date <= 60 then '31-60'
            when ${asOf}::date - ${invoices.dueDate}::date <= 90 then '61-90'
            else '90+'
          end`,
        totalCents: sql<number>`coalesce(sum(${invoices.balanceDueCents}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          sql`${invoices.balanceDueCents} > 0`,
          sql`${invoices.status} != 'void'`,
          sql`${invoices.status} != 'paid'`,
        ),
      )
      .groupBy(sql`1`)
  },

  async getProfitabilityReport(db: PostgresJsDatabase, query: ProfitabilityQuery) {
    const conditions = []

    if (query.from) {
      conditions.push(gte(bookings.startDate, query.from))
    }

    if (query.to) {
      conditions.push(lte(bookings.startDate, query.to))
    }

    return (await db
      .select({
        bookingId: bookings.id,
        bookingNumber: bookings.bookingNumber,
        sellAmountCents: bookings.sellAmountCents,
        costAmountCents: bookings.costAmountCents,
        marginPercent: bookings.marginPercent,
      })
      .from(bookings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(bookings.startDate), asc(bookings.createdAt))) as Array<{
      bookingId: string
      bookingNumber: string
      sellAmountCents: number | null
      costAmountCents: number | null
      marginPercent: number | null
    }>
  },

  async listSupplierPayments(db: PostgresJsDatabase, query: SupplierPaymentListQuery) {
    const conditions = []

    if (query.bookingId) {
      conditions.push(eq(supplierPayments.bookingId, query.bookingId))
    }

    if (query.supplierId) {
      conditions.push(eq(supplierPayments.supplierId, query.supplierId))
    }

    if (query.status) {
      conditions.push(eq(supplierPayments.status, query.status))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(supplierPayments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(supplierPayments.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(supplierPayments).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async createSupplierPayment(db: PostgresJsDatabase, data: CreateSupplierPaymentInput) {
    const [row] = await db
      .insert(supplierPayments)
      .values({ ...data, paymentInstrumentId: data.paymentInstrumentId ?? null })
      .returning()
    return row
  },

  async updateSupplierPayment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateSupplierPaymentInput,
  ) {
    const [row] = await db
      .update(supplierPayments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supplierPayments.id, id))
      .returning()

    return row ?? null
  },

  async listInvoices(db: PostgresJsDatabase, query: InvoiceListQuery) {
    const conditions = []

    if (query.status) {
      conditions.push(eq(invoices.status, query.status))
    }

    if (query.bookingId) {
      conditions.push(eq(invoices.bookingId, query.bookingId))
    }

    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(invoices.invoiceNumber, term), ilike(invoices.notes, term)))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(invoices.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async createInvoice(db: PostgresJsDatabase, data: CreateInvoiceInput) {
    const [row] = await db.insert(invoices).values(data).returning()
    return row
  },

  async createInvoiceFromBooking(
    db: PostgresJsDatabase,
    data: CreateInvoiceFromBookingInput,
    bookingData: InvoiceFromBookingData,
  ) {
    const { booking, items } = bookingData

    const itemIds = items.map((item) => item.id)

    const taxes =
      itemIds.length === 0
        ? []
        : await db
            .select()
            .from(bookingItemTaxLines)
            .where(or(...itemIds.map((id) => eq(bookingItemTaxLines.bookingItemId, id))))

    const commissions =
      itemIds.length === 0
        ? []
        : await db
            .select()
            .from(bookingItemCommissions)
            .where(or(...itemIds.map((id) => eq(bookingItemCommissions.bookingItemId, id))))

    const lineItems =
      items.length > 0
        ? items.map((item, sortOrder) => ({
            bookingItemId: item.id,
            description: item.title,
            quantity: item.quantity,
            unitPriceCents:
              item.unitSellAmountCents ??
              (item.totalSellAmountCents !== null && item.totalSellAmountCents !== undefined
                ? Math.floor(item.totalSellAmountCents / Math.max(item.quantity, 1))
                : 0),
            totalCents:
              item.totalSellAmountCents ??
              (item.unitSellAmountCents ?? 0) * Math.max(item.quantity, 1),
            taxRate: null,
            sortOrder,
          }))
        : [
            {
              bookingItemId: null as string | null,
              description: `Booking ${booking.bookingNumber}`,
              quantity: 1,
              unitPriceCents: booking.sellAmountCents ?? 0,
              totalCents: booking.sellAmountCents ?? 0,
              taxRate: null,
              sortOrder: 0,
            },
          ]

    const subtotalCents = lineItems.reduce((sum, line) => sum + line.totalCents, 0)
    const taxCents = taxes.reduce((sum, tax) => {
      if (tax.scope === "withheld" || tax.includedInPrice) {
        return sum
      }
      return sum + tax.amountCents
    }, 0)
    const totalCents = subtotalCents + taxCents
    const commissionAmountCents = commissions.reduce((sum, commission) => {
      return sum + (commission.amountCents ?? 0)
    }, 0)

    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          invoiceNumber: data.invoiceNumber,
          bookingId: booking.id,
          personId: booking.personId,
          organizationId: booking.organizationId,
          status: "draft",
          currency: booking.sellCurrency,
          baseCurrency: booking.baseCurrency,
          fxRateSetId: booking.fxRateSetId,
          subtotalCents,
          baseSubtotalCents: booking.baseSellAmountCents,
          taxCents,
          baseTaxCents: null,
          totalCents,
          baseTotalCents: booking.baseSellAmountCents,
          paidCents: 0,
          basePaidCents: 0,
          balanceDueCents: totalCents,
          baseBalanceDueCents: booking.baseSellAmountCents,
          commissionAmountCents: commissionAmountCents > 0 ? commissionAmountCents : null,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          notes: data.notes ?? null,
        })
        .returning()

      if (!invoice) {
        return null
      }

      await tx.insert(invoiceLineItems).values(
        lineItems.map((line) => ({
          invoiceId: invoice.id,
          bookingItemId: line.bookingItemId,
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.totalCents,
          taxRate: line.taxRate,
          sortOrder: line.sortOrder,
        })),
      )

      return invoice
    })
  },

  async getInvoiceById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
    return row ?? null
  },

  async updateInvoice(db: PostgresJsDatabase, id: string, data: UpdateInvoiceInput) {
    const [row] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning()

    return row ?? null
  },

  async deleteInvoice(db: PostgresJsDatabase, id: string) {
    const [existing] = await db
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1)

    if (!existing) {
      return { status: "not_found" as const }
    }

    if (existing.status !== "draft") {
      return { status: "not_draft" as const }
    }

    await db.delete(invoices).where(eq(invoices.id, id))
    return { status: "deleted" as const }
  },

  listInvoiceLineItems(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceLineItems.sortOrder))
  },

  async createInvoiceLineItem(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateInvoiceLineItemInput,
  ) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    if (!invoice) {
      return null
    }

    const [row] = await db
      .insert(invoiceLineItems)
      .values({ ...data, invoiceId })
      .returning()

    return row
  },

  async updateInvoiceLineItem(
    db: PostgresJsDatabase,
    lineId: string,
    data: UpdateInvoiceLineItemInput,
  ) {
    const [row] = await db
      .update(invoiceLineItems)
      .set(data)
      .where(eq(invoiceLineItems.id, lineId))
      .returning()

    return row ?? null
  },

  async deleteInvoiceLineItem(db: PostgresJsDatabase, lineId: string) {
    const [row] = await db
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.id, lineId))
      .returning({ id: invoiceLineItems.id })

    return row ?? null
  },

  listPayments(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate))
  },

  async createPayment(db: PostgresJsDatabase, invoiceId: string, data: CreatePaymentInput) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)

    if (!invoice) {
      return null
    }

    return db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(payments)
        .values({
          ...data,
          invoiceId,
          paymentInstrumentId: data.paymentInstrumentId ?? null,
          paymentAuthorizationId: data.paymentAuthorizationId ?? null,
          paymentCaptureId: data.paymentCaptureId ?? null,
        })
        .returning()

      const [sumResult] = await tx
        .select({ total: sql<number>`coalesce(sum(amount_cents), 0)::int` })
        .from(payments)
        .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "completed")))

      const paidCents = sumResult?.total ?? 0
      const balanceDueCents = Math.max(0, invoice.totalCents - paidCents)

      let newStatus = invoice.status
      if (paidCents >= invoice.totalCents) {
        newStatus = "paid"
      } else if (paidCents > 0) {
        newStatus = "partially_paid"
      }

      await tx
        .update(invoices)
        .set({ paidCents, balanceDueCents, status: newStatus, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))

      return payment
    })
  },

  listCreditNotes(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.invoiceId, invoiceId))
      .orderBy(desc(creditNotes.createdAt))
  },

  async createCreditNote(db: PostgresJsDatabase, invoiceId: string, data: CreateCreditNoteInput) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    if (!invoice) {
      return null
    }

    const [row] = await db
      .insert(creditNotes)
      .values({ ...data, invoiceId })
      .returning()

    return row
  },

  async updateCreditNote(
    db: PostgresJsDatabase,
    creditNoteId: string,
    data: UpdateCreditNoteInput,
  ) {
    const [row] = await db
      .update(creditNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(creditNotes.id, creditNoteId))
      .returning()

    return row ?? null
  },

  listCreditNoteLineItems(db: PostgresJsDatabase, creditNoteId: string) {
    return db
      .select()
      .from(creditNoteLineItems)
      .where(eq(creditNoteLineItems.creditNoteId, creditNoteId))
      .orderBy(asc(creditNoteLineItems.sortOrder))
  },

  async createCreditNoteLineItem(
    db: PostgresJsDatabase,
    creditNoteId: string,
    data: CreateCreditNoteLineItemInput,
  ) {
    const [creditNote] = await db
      .select({ id: creditNotes.id })
      .from(creditNotes)
      .where(eq(creditNotes.id, creditNoteId))
      .limit(1)

    if (!creditNote) {
      return null
    }

    const [row] = await db
      .insert(creditNoteLineItems)
      .values({ ...data, creditNoteId })
      .returning()

    return row
  },

  listNotes(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(financeNotes)
      .where(eq(financeNotes.invoiceId, invoiceId))
      .orderBy(financeNotes.createdAt)
  },

  async createNote(
    db: PostgresJsDatabase,
    invoiceId: string,
    userId: string,
    data: CreateFinanceNoteInput,
  ) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    if (!invoice) {
      return null
    }

    const [row] = await db
      .insert(financeNotes)
      .values({
        invoiceId,
        authorId: userId,
        content: data.content,
      })
      .returning()

    return row
  },

  // ============================================================================
  // Invoice number series
  // ============================================================================

  async listInvoiceNumberSeries(db: PostgresJsDatabase, query: InvoiceNumberSeriesListQuery) {
    const conditions = []
    if (query.scope) conditions.push(eq(invoiceNumberSeries.scope, query.scope))
    if (typeof query.active === "boolean")
      conditions.push(eq(invoiceNumberSeries.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(invoiceNumberSeries)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(invoiceNumberSeries.updatedAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(invoiceNumberSeries).where(where),
      query.limit,
      query.offset,
    )
  },

  async getInvoiceNumberSeriesById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(invoiceNumberSeries)
      .where(eq(invoiceNumberSeries.id, id))
      .limit(1)
    return row ?? null
  },

  async createInvoiceNumberSeries(db: PostgresJsDatabase, data: CreateInvoiceNumberSeriesInput) {
    const [row] = await db
      .insert(invoiceNumberSeries)
      .values({
        code: data.code,
        name: data.name,
        prefix: data.prefix,
        separator: data.separator,
        padLength: data.padLength,
        currentSequence: data.currentSequence,
        resetStrategy: data.resetStrategy,
        resetAt: toTimestamp(data.resetAt),
        scope: data.scope,
        active: data.active,
      })
      .returning()
    return row ?? null
  },

  async updateInvoiceNumberSeries(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateInvoiceNumberSeriesInput,
  ) {
    const { resetAt, ...rest } = data
    const [row] = await db
      .update(invoiceNumberSeries)
      .set({
        ...rest,
        ...(resetAt !== undefined ? { resetAt: toTimestamp(resetAt) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(invoiceNumberSeries.id, id))
      .returning()
    return row ?? null
  },

  async deleteInvoiceNumberSeries(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(invoiceNumberSeries)
      .where(eq(invoiceNumberSeries.id, id))
      .returning({ id: invoiceNumberSeries.id })
    return row ?? null
  },

  /**
   * Transactionally allocate the next invoice number from a series. Uses a
   * `SELECT ... FOR UPDATE` row lock to ensure concurrent callers each receive
   * a distinct sequence. Honours the series' `resetStrategy` (annual/monthly)
   * by resetting `currentSequence` to 1 at period boundaries.
   */
  async allocateInvoiceNumber(db: PostgresJsDatabase, seriesId: string) {
    return db.transaction(async (tx) => {
      const lockResult = await tx.execute(
        sql`SELECT id, prefix, separator, pad_length, current_sequence, reset_strategy, reset_at, active FROM invoice_number_series WHERE id = ${seriesId} FOR UPDATE`,
      )
      const row = lockResult[0] as
        | {
            id: string
            prefix: string
            separator: string
            pad_length: number
            current_sequence: number
            reset_strategy: "never" | "annual" | "monthly"
            reset_at: Date | null
            active: boolean
          }
        | undefined
      if (!row) return { status: "not_found" as const }
      if (!row.active) return { status: "inactive" as const }

      const now = new Date()
      const boundary = currentPeriodBoundary(row.reset_strategy, now)
      const shouldReset = boundary !== null && (row.reset_at === null || row.reset_at < boundary)

      const nextSequence = shouldReset ? 1 : row.current_sequence + 1
      const nextResetAt = boundary ?? row.reset_at

      await tx
        .update(invoiceNumberSeries)
        .set({
          currentSequence: nextSequence,
          resetAt: nextResetAt,
          updatedAt: now,
        })
        .where(eq(invoiceNumberSeries.id, seriesId))

      const formattedNumber = formatNumber(row.prefix, row.separator, row.pad_length, nextSequence)

      return {
        status: "allocated" as const,
        seriesId,
        sequence: nextSequence,
        formattedNumber,
      }
    })
  },

  // ============================================================================
  // Invoice templates
  // ============================================================================

  async listInvoiceTemplates(db: PostgresJsDatabase, query: InvoiceTemplateListQuery) {
    const conditions = []
    if (query.language) conditions.push(eq(invoiceTemplates.language, query.language))
    if (query.jurisdiction) conditions.push(eq(invoiceTemplates.jurisdiction, query.jurisdiction))
    if (typeof query.active === "boolean")
      conditions.push(eq(invoiceTemplates.active, query.active))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(invoiceTemplates.name, term), ilike(invoiceTemplates.slug, term)))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(invoiceTemplates)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(invoiceTemplates.updatedAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(invoiceTemplates).where(where),
      query.limit,
      query.offset,
    )
  },

  async getInvoiceTemplateById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.id, id))
      .limit(1)
    return row ?? null
  },

  async createInvoiceTemplate(db: PostgresJsDatabase, data: CreateInvoiceTemplateInput) {
    const [row] = await db
      .insert(invoiceTemplates)
      .values({
        name: data.name,
        slug: data.slug,
        language: data.language,
        jurisdiction: data.jurisdiction ?? null,
        bodyFormat: data.bodyFormat,
        body: data.body,
        cssStyles: data.cssStyles ?? null,
        isDefault: data.isDefault,
        active: data.active,
        metadata: data.metadata ?? null,
      })
      .returning()
    return row ?? null
  },

  async updateInvoiceTemplate(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateInvoiceTemplateInput,
  ) {
    const [row] = await db
      .update(invoiceTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoiceTemplates.id, id))
      .returning()
    return row ?? null
  },

  async deleteInvoiceTemplate(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(invoiceTemplates)
      .where(eq(invoiceTemplates.id, id))
      .returning({ id: invoiceTemplates.id })
    return row ?? null
  },

  // ============================================================================
  // Invoice renditions
  // ============================================================================

  async listInvoiceRenditions(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(invoiceRenditions)
      .where(eq(invoiceRenditions.invoiceId, invoiceId))
      .orderBy(desc(invoiceRenditions.createdAt))
  },

  async getInvoiceRenditionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(invoiceRenditions)
      .where(eq(invoiceRenditions.id, id))
      .limit(1)
    return row ?? null
  },

  async createInvoiceRendition(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateInvoiceRenditionInput,
  ) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    if (!invoice) return null

    const [row] = await db
      .insert(invoiceRenditions)
      .values({
        invoiceId,
        templateId: data.templateId ?? null,
        format: data.format,
        status: data.status,
        storageKey: data.storageKey ?? null,
        fileSize: data.fileSize ?? null,
        checksum: data.checksum ?? null,
        language: data.language ?? null,
        errorMessage: data.errorMessage ?? null,
        generatedAt: toTimestamp(data.generatedAt),
        metadata: data.metadata ?? null,
      })
      .returning()
    return row ?? null
  },

  async updateInvoiceRendition(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateInvoiceRenditionInput,
  ) {
    const { generatedAt, ...rest } = data
    const [row] = await db
      .update(invoiceRenditions)
      .set({
        ...rest,
        ...(generatedAt !== undefined ? { generatedAt: toTimestamp(generatedAt) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(invoiceRenditions.id, id))
      .returning()
    return row ?? null
  },

  async deleteInvoiceRendition(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(invoiceRenditions)
      .where(eq(invoiceRenditions.id, id))
      .returning({ id: invoiceRenditions.id })
    return row ?? null
  },

  /**
   * Request an invoice rendition. Creates a `pending` rendition row pointing
   * to a template; the actual rendering (HTML→PDF) is expected to be
   * performed out-of-band by a background job that updates the rendition to
   * `ready` with `storageKey` set.
   */
  async renderInvoice(db: PostgresJsDatabase, invoiceId: string, input: RenderInvoiceInput) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
    if (!invoice) return { status: "not_found" as const }

    // Resolve template: explicit input > invoice.templateId > default template
    let templateId = input.templateId ?? invoice.templateId ?? null
    if (!templateId) {
      const [defaultTemplate] = await db
        .select({ id: invoiceTemplates.id })
        .from(invoiceTemplates)
        .where(and(eq(invoiceTemplates.isDefault, true), eq(invoiceTemplates.active, true)))
        .limit(1)
      templateId = defaultTemplate?.id ?? null
    }

    const [row] = await db
      .insert(invoiceRenditions)
      .values({
        invoiceId,
        templateId,
        format: input.format,
        status: "pending",
        language: input.language ?? invoice.language ?? null,
      })
      .returning()

    return { status: "requested" as const, rendition: row ?? null }
  },

  // ============================================================================
  // Tax regimes
  // ============================================================================

  async listTaxRegimes(db: PostgresJsDatabase, query: TaxRegimeListQuery) {
    const conditions = []
    if (query.code) conditions.push(eq(taxRegimes.code, query.code))
    if (query.jurisdiction) conditions.push(eq(taxRegimes.jurisdiction, query.jurisdiction))
    if (typeof query.active === "boolean") conditions.push(eq(taxRegimes.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(taxRegimes)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(taxRegimes.updatedAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(taxRegimes).where(where),
      query.limit,
      query.offset,
    )
  },

  async getTaxRegimeById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(taxRegimes).where(eq(taxRegimes.id, id)).limit(1)
    return row ?? null
  },

  async createTaxRegime(db: PostgresJsDatabase, data: CreateTaxRegimeInput) {
    const [row] = await db
      .insert(taxRegimes)
      .values({
        code: data.code,
        name: data.name,
        jurisdiction: data.jurisdiction ?? null,
        ratePercent: data.ratePercent ?? null,
        description: data.description ?? null,
        legalReference: data.legalReference ?? null,
        active: data.active,
        metadata: data.metadata ?? null,
      })
      .returning()
    return row ?? null
  },

  async updateTaxRegime(db: PostgresJsDatabase, id: string, data: UpdateTaxRegimeInput) {
    const [row] = await db
      .update(taxRegimes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxRegimes.id, id))
      .returning()
    return row ?? null
  },

  async deleteTaxRegime(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(taxRegimes)
      .where(eq(taxRegimes.id, id))
      .returning({ id: taxRegimes.id })
    return row ?? null
  },

  // ============================================================================
  // Invoice external refs (e-invoicing provider ids)
  // ============================================================================

  async listInvoiceExternalRefs(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(invoiceExternalRefs)
      .where(eq(invoiceExternalRefs.invoiceId, invoiceId))
      .orderBy(desc(invoiceExternalRefs.createdAt))
  },

  /**
   * Idempotent upsert on (invoiceId, provider). Used by e-invoicing plugins
   * (SmartBill, e-Factura, Stripe) to register the external reference
   * immediately after a successful provider call.
   */
  async registerInvoiceExternalRef(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateInvoiceExternalRefInput,
  ) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    if (!invoice) return null

    const [existing] = await db
      .select()
      .from(invoiceExternalRefs)
      .where(
        and(
          eq(invoiceExternalRefs.invoiceId, invoiceId),
          eq(invoiceExternalRefs.provider, data.provider),
        ),
      )
      .limit(1)

    const values = {
      externalId: data.externalId ?? null,
      externalNumber: data.externalNumber ?? null,
      externalUrl: data.externalUrl ?? null,
      status: data.status ?? null,
      metadata: data.metadata ?? null,
      syncedAt: toTimestamp(data.syncedAt),
      syncError: data.syncError ?? null,
    }

    if (existing) {
      const [row] = await db
        .update(invoiceExternalRefs)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(invoiceExternalRefs.id, existing.id))
        .returning()
      return row ?? null
    }

    const [row] = await db
      .insert(invoiceExternalRefs)
      .values({
        invoiceId,
        provider: data.provider,
        ...values,
      })
      .returning()
    return row ?? null
  },

  async deleteInvoiceExternalRef(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(invoiceExternalRefs)
      .where(eq(invoiceExternalRefs.id, id))
      .returning({ id: invoiceExternalRefs.id })
    return row ?? null
  },
}
