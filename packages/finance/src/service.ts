import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyantjs/action-ledger"
import { bookingItems, bookings } from "@voyantjs/bookings/schema"
import type { EventBus } from "@voyantjs/core"
import { renderStructuredTemplate } from "@voyantjs/utils/template-renderer"
import { and, asc, desc, eq, gte, ilike, lte, ne, or, sql } from "drizzle-orm"
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
  invoiceAttachments,
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
  taxClasses,
  taxPolicyProfiles,
  taxPolicyRules,
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
  insertInvoiceAttachmentSchema,
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
  insertTaxClassSchema,
  insertTaxPolicyProfileSchema,
  insertTaxPolicyRuleSchema,
  insertTaxRegimeSchema,
  invoiceFromBookingSchema,
  invoiceListQuerySchema,
  invoiceNumberSeriesListQuerySchema,
  invoiceTemplateListQuerySchema,
  markPaymentSessionRequiresRedirectSchema,
  paymentAuthorizationListQuerySchema,
  paymentCaptureListQuerySchema,
  paymentInstrumentListQuerySchema,
  paymentListQuerySchema,
  paymentSessionListQuerySchema,
  profitabilityQuerySchema,
  renderInvoiceInputSchema,
  revenueReportQuerySchema,
  supplierPaymentListQuerySchema,
  taxClassListQuerySchema,
  taxPolicyProfileListQuerySchema,
  taxPolicyRuleListQuerySchema,
  taxRegimeListQuerySchema,
  updateBookingGuaranteeSchema,
  updateBookingItemCommissionSchema,
  updateBookingItemTaxLineSchema,
  updateBookingPaymentScheduleSchema,
  updateCreditNoteSchema,
  updateInvoiceAttachmentSchema,
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
  updateTaxClassSchema,
  updateTaxPolicyProfileSchema,
  updateTaxPolicyRuleSchema,
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
type PaymentListQuery = z.infer<typeof paymentListQuerySchema>

export class PaymentValidationError extends Error {
  readonly status = 400
  readonly code = "invalid_request"
  readonly details?: Record<string, unknown>

  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "PaymentValidationError"
    this.details = details
  }
}

export interface UnifiedPaymentRow {
  kind: "customer" | "supplier"
  id: string
  invoiceId: string | null
  /** Customer-side: human-readable invoice number from `invoices.invoice_number`. */
  invoiceNumber: string | null
  bookingId: string | null
  /** Supplier-side: human-readable booking number from `bookings.booking_number`. */
  bookingNumber: string | null
  supplierId: string | null
  /** Supplier-side: supplier display name from `suppliers.name`. */
  supplierName: string | null
  /** Customer-side: person who paid, joined via invoice → people. */
  personId: string | null
  personName: string | null
  /** Customer-side: organization that paid, joined via invoice → organizations. */
  organizationId: string | null
  organizationName: string | null
  amountCents: number
  currency: string
  baseCurrency: string | null
  baseAmountCents: number | null
  paymentMethod: string
  status: string
  referenceNumber: string | null
  paymentDate: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}
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
type CreateInvoiceAttachmentInput = z.infer<typeof insertInvoiceAttachmentSchema>
type UpdateInvoiceAttachmentInput = z.infer<typeof updateInvoiceAttachmentSchema>
type TaxRegimeListQuery = z.infer<typeof taxRegimeListQuerySchema>
type CreateTaxRegimeInput = z.infer<typeof insertTaxRegimeSchema>
type UpdateTaxRegimeInput = z.infer<typeof updateTaxRegimeSchema>
type TaxClassListQuery = z.infer<typeof taxClassListQuerySchema>
type CreateTaxClassInput = z.infer<typeof insertTaxClassSchema>
type UpdateTaxClassInput = z.infer<typeof updateTaxClassSchema>
type TaxPolicyProfileListQuery = z.infer<typeof taxPolicyProfileListQuerySchema>
type CreateTaxPolicyProfileInput = z.infer<typeof insertTaxPolicyProfileSchema>
type UpdateTaxPolicyProfileInput = z.infer<typeof updateTaxPolicyProfileSchema>
type TaxPolicyRuleListQuery = z.infer<typeof taxPolicyRuleListQuerySchema>
type CreateTaxPolicyRuleInput = z.infer<typeof insertTaxPolicyRuleSchema>
type UpdateTaxPolicyRuleInput = z.infer<typeof updateTaxPolicyRuleSchema>
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

function bookingItemToInvoiceLine(
  item: InvoiceFromBookingData["items"][number],
  taxes: Array<typeof bookingItemTaxLines.$inferSelect>,
  sortOrder: number,
) {
  const quantity = Math.max(item.quantity, 1)
  const totalCents =
    item.totalSellAmountCents ?? (item.unitSellAmountCents ?? 0) * Math.max(item.quantity, 1)
  const firstTaxWithRate = taxes.find(
    (tax) => tax.scope !== "withheld" && tax.rateBasisPoints != null,
  )

  return {
    bookingItemId: item.id,
    description: item.title,
    quantity: item.quantity,
    unitPriceCents:
      item.unitSellAmountCents ??
      (item.totalSellAmountCents !== null && item.totalSellAmountCents !== undefined
        ? Math.floor(item.totalSellAmountCents / quantity)
        : 0),
    totalCents,
    taxRate:
      firstTaxWithRate?.rateBasisPoints != null
        ? Math.round(firstTaxWithRate.rateBasisPoints / 100)
        : null,
    sortOrder,
  }
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
  actionLedgerContext?: ActionLedgerRequestContextValues
  actionLedgerAuthorizationSource?: string | null
}

export interface BookingPaymentSchedulePaidEvent {
  bookingId: string
  bookingPaymentScheduleId: string
  paymentSessionId: string
  paymentId: string | null
  scheduleType: (typeof bookingPaymentSchedules.$inferSelect)["scheduleType"]
  amountCents: number
  currency: string
  provider: string | null
}

export interface PaymentCompletedEvent {
  paymentSessionId: string
  targetType: (typeof paymentSessions.$inferSelect)["targetType"]
  targetId: string | null
  bookingId: string | null
  orderId: string | null
  invoiceId: string | null
  bookingPaymentScheduleId: string | null
  bookingGuaranteeId: string | null
  amountCents: number
  currency: string
  provider: string | null
}

type PaymentSessionRecord = typeof paymentSessions.$inferSelect
type InvoiceRecord = typeof invoices.$inferSelect
type PaymentRecord = typeof payments.$inferSelect
type CreditNoteRecord = typeof creditNotes.$inferSelect
type CompletePaymentSessionLedgerInput = {
  session: PaymentSessionRecord
  status: CompletePaymentSessionInput["status"]
  paymentId: string | null
}
type RecordPaymentLedgerInput = {
  invoice: InvoiceRecord
  payment: PaymentRecord
}
type InvoiceIssuedLedgerInput = {
  invoice: InvoiceRecord
}
type InvoiceUpdateLedgerInput = {
  invoice: InvoiceRecord
  changes: UpdateInvoiceInput
}
type InvoiceDeleteLedgerInput = {
  invoice: InvoiceRecord
}
type InvoiceLineItemRecord = typeof invoiceLineItems.$inferSelect
type InvoiceLineItemMutationLedgerInput = {
  invoice: InvoiceRecord
  lineItem: InvoiceLineItemRecord
  changes?: UpdateInvoiceLineItemInput
}
type CreateCreditNoteLedgerInput = {
  invoice: InvoiceRecord
  creditNote: CreditNoteRecord
}

export async function buildPaymentSessionCompletionActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: CompletePaymentSessionLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getPaymentSessionCompletionLedgerTarget(input.session)
  const idempotencyKey =
    input.session.providerPaymentId ??
    input.session.externalReference ??
    input.session.idempotencyKey ??
    null
  const idempotencyFingerprint = idempotencyKey
    ? await buildIdempotencyFingerprint({
        actionName: "finance.payment_session.complete",
        actionVersion: "v1",
        targetType: target.type,
        targetId: target.id,
        commandInput: {
          paymentSessionId: input.session.id,
          status: input.status,
          providerPaymentId: input.session.providerPaymentId,
          externalReference: input.session.externalReference,
          paymentId: input.paymentId,
        },
      })
    : null

  return {
    context,
    actionName: "finance.payment_session.complete",
    actionVersion: "v1",
    actionKind: "execute",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_session.complete",
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
    idempotencyScope: idempotencyKey
      ? `finance.payment_session:${input.session.id}:complete`
      : null,
    idempotencyKey,
    idempotencyFingerprint,
    mutationDetail: {
      commandInputRef: `payment_session:${input.session.id}:complete`,
      commandResultRef: input.paymentId ? `payment:${input.paymentId}` : null,
      summary: `Payment session ${input.session.id} completed as ${input.status}`,
      reversalKind: "none",
    },
  }
}

function getPaymentSessionCompletionLedgerTarget(session: PaymentSessionRecord) {
  if (session.bookingId) return { type: "booking", id: session.bookingId }
  if (session.invoiceId) return { type: "invoice", id: session.invoiceId }
  if (session.orderId) return { type: "order", id: session.orderId }
  return { type: "payment_session", id: session.id }
}

export async function buildRecordPaymentActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: RecordPaymentLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getInvoiceLedgerTarget(input.invoice)
  const idempotencyKey =
    input.payment.referenceNumber ??
    input.payment.paymentCaptureId ??
    input.payment.paymentAuthorizationId ??
    null
  const idempotencyFingerprint = idempotencyKey
    ? await buildIdempotencyFingerprint({
        actionName: "finance.payment.record",
        actionVersion: "v1",
        targetType: target.type,
        targetId: target.id,
        commandInput: {
          invoiceId: input.invoice.id,
          paymentId: input.payment.id,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency,
          paymentMethod: input.payment.paymentMethod,
          paymentDate: input.payment.paymentDate,
          referenceNumber: input.payment.referenceNumber,
          paymentAuthorizationId: input.payment.paymentAuthorizationId,
          paymentCaptureId: input.payment.paymentCaptureId,
        },
      })
    : null

  return {
    context,
    actionName: "finance.payment.record",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment.record",
    authorizationSource: options.authorizationSource ?? "finance.payment.route",
    idempotencyScope: idempotencyKey ? `finance.invoice:${input.invoice.id}:payment` : null,
    idempotencyKey,
    idempotencyFingerprint,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:payment`,
      commandResultRef: `payment:${input.payment.id}`,
      summary: `Payment ${input.payment.id} recorded for invoice ${input.invoice.id}`,
      reversalKind: "none",
    },
  }
}

function getInvoiceLedgerTarget(invoice: InvoiceRecord) {
  if (invoice.bookingId) return { type: "booking", id: invoice.bookingId }
  return { type: "invoice", id: invoice.id }
}

export async function buildInvoiceIssuedActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceIssuedLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getInvoiceLedgerTarget(input.invoice)
  const invoiceTypeLabel = input.invoice.invoiceType === "proforma" ? "Proforma" : "Invoice"

  return {
    context,
    actionName: "finance.invoice.issue_from_booking",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice.issue_from_booking",
    authorizationSource: options.authorizationSource ?? "finance.invoice.from_booking.route",
    idempotencyScope: `finance.booking:${input.invoice.bookingId}:invoice_issue`,
    idempotencyKey: input.invoice.invoiceNumber,
    idempotencyFingerprint: await buildIdempotencyFingerprint({
      actionName: "finance.invoice.issue_from_booking",
      actionVersion: "v1",
      targetType: target.type,
      targetId: target.id,
      commandInput: {
        invoiceId: input.invoice.id,
        invoiceNumber: input.invoice.invoiceNumber,
        invoiceType: input.invoice.invoiceType,
        bookingId: input.invoice.bookingId,
        totalCents: input.invoice.totalCents,
        currency: input.invoice.currency,
        status: input.invoice.status,
        issueDate: input.invoice.issueDate,
        dueDate: input.invoice.dueDate,
      },
    }),
    mutationDetail: {
      commandInputRef: `booking:${input.invoice.bookingId}:invoice_issue`,
      commandResultRef: `invoice:${input.invoice.id}`,
      summary: `${invoiceTypeLabel} ${input.invoice.invoiceNumber} issued for booking ${input.invoice.bookingId}`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.invoice.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice.update",
    authorizationSource: options.authorizationSource ?? "finance.invoice.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:update`,
      commandResultRef: `invoice:${input.invoice.id}`,
      summary: `Invoice ${input.invoice.invoiceNumber} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceDeleteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)

  return {
    context,
    actionName: "finance.invoice.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice.delete",
    authorizationSource: options.authorizationSource ?? "finance.invoice.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:delete`,
      commandResultRef: null,
      summary: `Draft invoice ${input.invoice.invoiceNumber} deleted`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceLineItemCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceLineItemMutationLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)

  return {
    context,
    actionName: "finance.invoice_line_item.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice_line_item.create",
    authorizationSource: options.authorizationSource ?? "finance.invoice_line_item.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:line_item`,
      commandResultRef: `invoice_line_item:${input.lineItem.id}`,
      summary: `Line item ${input.lineItem.id} added to invoice ${input.invoice.invoiceNumber}`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceLineItemUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceLineItemMutationLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)
  const changedFields = Object.keys(input.changes ?? {}).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.invoice_line_item.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice_line_item.update",
    authorizationSource: options.authorizationSource ?? "finance.invoice_line_item.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice_line_item:${input.lineItem.id}:update`,
      commandResultRef: `invoice_line_item:${input.lineItem.id}`,
      summary: `Line item ${input.lineItem.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceLineItemDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceLineItemMutationLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)

  return {
    context,
    actionName: "finance.invoice_line_item.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice_line_item.delete",
    authorizationSource: options.authorizationSource ?? "finance.invoice_line_item.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice_line_item:${input.lineItem.id}:delete`,
      commandResultRef: null,
      summary: `Line item ${input.lineItem.id} deleted from invoice ${input.invoice.invoiceNumber}`,
      reversalKind: "none",
    },
  }
}

export async function buildCreditNoteCreationActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: CreateCreditNoteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getInvoiceLedgerTarget(input.invoice)
  const idempotencyKey = input.creditNote.creditNoteNumber

  return {
    context,
    actionName: "finance.credit_note.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.credit_note.create",
    authorizationSource: options.authorizationSource ?? "finance.credit_note.route",
    idempotencyScope: `finance.invoice:${input.invoice.id}:credit_note`,
    idempotencyKey,
    idempotencyFingerprint: await buildIdempotencyFingerprint({
      actionName: "finance.credit_note.create",
      actionVersion: "v1",
      targetType: target.type,
      targetId: target.id,
      commandInput: {
        invoiceId: input.invoice.id,
        creditNoteId: input.creditNote.id,
        creditNoteNumber: input.creditNote.creditNoteNumber,
        amountCents: input.creditNote.amountCents,
        currency: input.creditNote.currency,
        status: input.creditNote.status,
        reason: input.creditNote.reason,
      },
    }),
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:credit_note`,
      commandResultRef: `credit_note:${input.creditNote.id}`,
      summary: `Credit note ${input.creditNote.creditNoteNumber} created for invoice ${input.invoice.id}`,
      reversalKind: "none",
    },
  }
}

export interface BindInvoiceRenditionInput {
  templateId?: string | null
  format: (typeof invoiceRenditions.$inferSelect)["format"]
  storageKey?: string | null
  contentType: string
  fileSize?: number | null
  checksum?: string | null
  language?: string | null
  generatedAt?: string | null
  metadata?: Record<string, unknown> | null
  replaceExisting?: boolean
}

export interface InvoiceRenderedEvent {
  invoiceId: string
  invoiceStatus: (typeof invoices.$inferSelect)["status"]
  invoiceType: (typeof invoices.$inferSelect)["invoiceType"]
  renditionId: string
  format: (typeof invoiceRenditions.$inferSelect)["format"]
  storageKey: string | null
  contentType: string
  byteSize: number | null
  contentHash: string | null
}

export function buildBookingPaymentSchedulePaidEvent(
  schedule: typeof bookingPaymentSchedules.$inferSelect,
  session: typeof paymentSessions.$inferSelect,
  paymentId: string | null,
): BookingPaymentSchedulePaidEvent {
  return {
    bookingId: schedule.bookingId,
    bookingPaymentScheduleId: schedule.id,
    paymentSessionId: session.id,
    paymentId,
    scheduleType: schedule.scheduleType,
    amountCents: schedule.amountCents,
    currency: schedule.currency,
    provider: session.provider,
  }
}

export function buildPaymentCompletedEvent(
  session: typeof paymentSessions.$inferSelect,
): PaymentCompletedEvent {
  return {
    paymentSessionId: session.id,
    targetType: session.targetType,
    targetId: session.targetId,
    bookingId: session.bookingId,
    orderId: session.orderId,
    invoiceId: session.invoiceId,
    bookingPaymentScheduleId: session.bookingPaymentScheduleId,
    bookingGuaranteeId: session.bookingGuaranteeId,
    amountCents: session.amountCents,
    currency: session.currency,
    provider: session.provider,
  }
}

interface RawUnifiedPaymentRow {
  kind: "customer" | "supplier"
  id: string
  invoice_id: string | null
  invoice_number: string | null
  booking_id: string | null
  booking_number: string | null
  supplier_id: string | null
  supplier_name: string | null
  person_id: string | null
  person_first_name: string | null
  person_last_name: string | null
  organization_id: string | null
  organization_name: string | null
  amount_cents: number
  currency: string
  base_currency: string | null
  base_amount_cents: number | null
  payment_method: string
  status: string
  reference_number: string | null
  payment_date: string
  notes: string | null
  created_at: Date | string
  updated_at: Date | string
}

function mapRawPayment(row: RawUnifiedPaymentRow): UnifiedPaymentRow {
  // Person display name: "First Last", trimmed. Falls back to null when both
  // halves are missing so the UI can swap to organization or hide the field.
  const personName =
    row.person_first_name || row.person_last_name
      ? `${row.person_first_name ?? ""} ${row.person_last_name ?? ""}`.trim() || null
      : null

  return {
    kind: row.kind,
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    bookingId: row.booking_id,
    bookingNumber: row.booking_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    personId: row.person_id,
    personName,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    amountCents: row.amount_cents,
    currency: row.currency,
    baseCurrency: row.base_currency,
    baseAmountCents: row.base_amount_cents,
    paymentMethod: row.payment_method,
    status: row.status,
    referenceNumber: row.reference_number,
    paymentDate: row.payment_date,
    notes: row.notes,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  }
}

function paymentSettlementAmountSql(invoiceCurrency: string) {
  return sql<number>`
    coalesce(
      sum(
        case
          when ${payments.currency} = ${invoiceCurrency} then ${payments.amountCents}
          when ${payments.baseCurrency} = ${invoiceCurrency} then coalesce(${payments.baseAmountCents}, 0)
          else 0
        end
      ),
      0
    )::int
  `
}

function assertPaymentCanSettleInvoice(invoiceCurrency: string, data: CreatePaymentInput) {
  if (data.status !== "completed" || data.currency === invoiceCurrency) {
    return
  }

  if (data.baseCurrency === invoiceCurrency && data.baseAmountCents && data.baseAmountCents > 0) {
    return
  }

  throw new PaymentValidationError(
    "Completed cross-currency payments require a base amount in the invoice currency",
    {
      invoiceCurrency,
      paymentCurrency: data.currency,
      fields: ["baseCurrency", "baseAmountCents"],
    },
  )
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
      let bookingSchedulePaidForEmit: BookingPaymentSchedulePaidEvent | null = null

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
        const [paidSchedule] = await tx
          .update(bookingPaymentSchedules)
          .set({ status: "paid", updatedAt: new Date() })
          .where(
            and(
              eq(bookingPaymentSchedules.id, session.bookingPaymentScheduleId),
              ne(bookingPaymentSchedules.status, "paid"),
            ),
          )
          .returning()

        if (paidSchedule) {
          bookingSchedulePaidForEmit = buildBookingPaymentSchedulePaidEvent(
            paidSchedule,
            session,
            paymentId,
          )
        }
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

      if (updated && runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          await buildPaymentSessionCompletionActionLedgerInput(
            runtime.actionLedgerContext,
            {
              session: updated,
              status: data.status,
              paymentId,
            },
            {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            },
          ),
        )
      }

      return {
        updated: updated ?? null,
        settlement: settlementForEmit,
        bookingSchedulePaid: bookingSchedulePaidForEmit,
      }
    })

    if (txResult.settlement) {
      await runtime.eventBus?.emit("invoice.settled", txResult.settlement, {
        category: "domain",
        source: "service",
      })
    }

    if (txResult.bookingSchedulePaid) {
      await runtime.eventBus?.emit("booking_payment_schedule.paid", txResult.bookingSchedulePaid, {
        category: "domain",
        source: "service",
      })
    }

    // Emit a generic `payment.completed` so cross-vertical subscribers
    // (notably the storefront's checkout-finalize workflow) can react
    // without having to know the specific provider chain. Keyed by
    // booking when the session targets one — that's the field the
    // checkout flow needs.
    if (
      data.status === "paid" &&
      txResult.updated &&
      (session.bookingId || session.orderId || session.invoiceId)
    ) {
      await runtime.eventBus?.emit("payment.completed", buildPaymentCompletedEvent(session), {
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

  /**
   * Persist a payment schedule that was already computed elsewhere
   * (typically by `computePaymentSchedule()` from the policy primitive).
   *
   * Idempotency: when `replace: true` (the default), any existing
   * pending/due schedule rows on the booking are cleared first so a
   * re-fire of the same hook doesn't pile up duplicate rows. Set
   * `replace: false` to insert alongside existing rows (e.g. when
   * inserting a manually-added one-off installment).
   *
   * Skips silently when the booking row doesn't exist (returns
   * `null`) or when there are no entries to persist.
   */
  async applyComputedPaymentSchedule(
    db: PostgresJsDatabase,
    bookingId: string,
    entries: Array<{
      // `"full"` is accepted from the policy primitive and stored as
      // `"balance"` (the DB enum doesn't have a "full" variant).
      scheduleType: "deposit" | "balance" | "installment" | "hold" | "other" | "full"
      amountCents: number
      currency: string
      dueDate: string
      notes?: string | null
    }>,
    options: { replace?: boolean } = {},
  ) {
    if (entries.length === 0) return []

    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
    if (!booking) return null

    const replace = options.replace ?? true
    if (replace) {
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

    const today = startOfUtcDay(new Date())
    const rows = entries.map((entry) => {
      const due = parseDateString(entry.dueDate) ?? today
      // The `full` schedule kind from the policy primitive collapses
      // to a `balance` row in the DB (the table only has
      // deposit/installment/balance/hold/other) — semantically the
      // single full-payment row IS the balance to settle.
      const persistedType =
        (entry.scheduleType as string) === "full" ? "balance" : entry.scheduleType
      return {
        bookingId,
        bookingItemId: null,
        scheduleType: persistedType as "deposit" | "balance" | "installment" | "hold" | "other",
        status: (due <= today ? "due" : "pending") as "pending" | "due",
        dueDate: entry.dueDate,
        currency: entry.currency,
        amountCents: Math.max(0, Math.round(entry.amountCents)),
        notes: entry.notes ?? null,
      }
    })

    return db.insert(bookingPaymentSchedules).values(rows).returning()
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

    if (query.paymentMethod) {
      conditions.push(eq(supplierPayments.paymentMethod, query.paymentMethod))
    }

    if (query.currency) {
      conditions.push(eq(supplierPayments.currency, query.currency))
    }

    if (query.paymentDateFrom) {
      conditions.push(gte(supplierPayments.paymentDate, query.paymentDateFrom))
    }

    if (query.paymentDateTo) {
      conditions.push(lte(supplierPayments.paymentDate, query.paymentDateTo))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = (() => {
      switch (query.sortBy) {
        case "amountCents":
          return supplierPayments.amountCents
        case "status":
          return supplierPayments.status
        case "paymentDate":
          return supplierPayments.paymentDate
        default:
          return supplierPayments.createdAt
      }
    })()
    const sortFn = query.sortDir === "asc" ? asc : desc

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(supplierPayments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(sortFn(sortColumn), desc(supplierPayments.createdAt)),
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

    if (query.personId) {
      conditions.push(eq(invoices.personId, query.personId))
    }

    if (query.organizationId) {
      conditions.push(eq(invoices.organizationId, query.organizationId))
    }

    if (query.currency) {
      conditions.push(eq(invoices.currency, query.currency))
    }

    if (query.dueDateFrom) {
      conditions.push(gte(invoices.dueDate, query.dueDateFrom))
    }

    if (query.dueDateTo) {
      conditions.push(lte(invoices.dueDate, query.dueDateTo))
    }

    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(invoices.invoiceNumber, term), ilike(invoices.notes, term)))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = (() => {
      switch (query.sortBy) {
        case "invoiceNumber":
          return invoices.invoiceNumber
        case "status":
          return invoices.status
        case "totalCents":
          return invoices.totalCents
        case "paidCents":
          return invoices.paidCents
        case "balanceDueCents":
          return invoices.balanceDueCents
        case "issueDate":
          return invoices.issueDate
        case "dueDate":
          return invoices.dueDate
        default:
          return invoices.createdAt
      }
    })()
    const sortFn = query.sortDir === "asc" ? asc : desc

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(sortFn(sortColumn), desc(invoices.createdAt)),
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

    const taxesByBookingItemId = new Map<string, typeof taxes>()
    for (const tax of taxes) {
      const existing = taxesByBookingItemId.get(tax.bookingItemId) ?? []
      existing.push(tax)
      taxesByBookingItemId.set(tax.bookingItemId, existing)
    }

    const lineItems =
      items.length > 0
        ? items.map((item, sortOrder) => ({
            ...bookingItemToInvoiceLine(item, taxesByBookingItemId.get(item.id) ?? [], sortOrder),
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

    const grossLineTotalCents = lineItems.reduce((sum, line) => sum + line.totalCents, 0)
    const includedTaxCents = taxes.reduce((sum, tax) => {
      if (tax.scope === "withheld" || !tax.includedInPrice) return sum
      return sum + tax.amountCents
    }, 0)
    const excludedTaxCents = taxes.reduce((sum, tax) => {
      if (tax.scope === "withheld" || tax.includedInPrice) return sum
      return sum + tax.amountCents
    }, 0)
    const subtotalCents = Math.max(0, grossLineTotalCents - includedTaxCents)
    const taxCents = includedTaxCents + excludedTaxCents
    const totalCents = subtotalCents + taxCents
    const commissionAmountCents = commissions.reduce((sum, commission) => {
      return sum + (commission.amountCents ?? 0)
    }, 0)

    // The `ck_invoices_base_currency_amounts` constraint requires
    // that whenever ANY base_*_cents column is non-null, base_currency
    // must be set too. Bookings without an FX-rate set leave
    // baseCurrency null — propagate that NULL across every base_*
    // field so the constraint stays satisfied.
    const hasBaseCurrency = Boolean(booking.baseCurrency)

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
          baseSubtotalCents: hasBaseCurrency ? (booking.baseSellAmountCents ?? null) : null,
          taxCents,
          baseTaxCents: null,
          totalCents,
          baseTotalCents: hasBaseCurrency ? (booking.baseSellAmountCents ?? null) : null,
          paidCents: 0,
          basePaidCents: hasBaseCurrency ? 0 : null,
          balanceDueCents: totalCents,
          baseBalanceDueCents: hasBaseCurrency ? (booking.baseSellAmountCents ?? null) : null,
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

  async updateInvoice(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateInvoiceInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateInvoiceRow = (writer: PostgresJsDatabase) =>
      writer
        .update(invoices)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(invoices.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [row] = await updateInvoiceRow(tx)

        if (row) {
          await appendActionLedgerMutation(
            tx,
            buildInvoiceUpdateActionLedgerInput(
              actionLedgerContext,
              { invoice: row, changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return row ?? null
      })
    }

    const [row] = await updateInvoiceRow(db)
    return row ?? null
  },

  async deleteInvoice(db: PostgresJsDatabase, id: string, runtime: FinanceServiceRuntime = {}) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1)

        if (!existing) {
          return { status: "not_found" as const }
        }

        if (existing.status !== "draft") {
          return { status: "not_draft" as const }
        }

        await tx.delete(invoices).where(eq(invoices.id, id))
        await appendActionLedgerMutation(
          tx,
          buildInvoiceDeleteActionLedgerInput(
            actionLedgerContext,
            { invoice: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
        return { status: "deleted" as const }
      })
    }

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
    runtime: FinanceServiceRuntime = {},
  ) {
    const createLineItem = async (writer: PostgresJsDatabase) => {
      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)

      if (!invoice) {
        return null
      }

      const [row] = await writer
        .insert(invoiceLineItems)
        .values({ ...data, invoiceId })
        .returning()

      return row ? { invoice, lineItem: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const created = await createLineItem(tx)

        if (created) {
          await appendActionLedgerMutation(
            tx,
            buildInvoiceLineItemCreateActionLedgerInput(actionLedgerContext, created, {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            }),
          )
        }

        return created
      })

      return result?.lineItem ?? null
    }

    return (await createLineItem(db))?.lineItem ?? null
  },

  async updateInvoiceLineItem(
    db: PostgresJsDatabase,
    lineId: string,
    data: UpdateInvoiceLineItemInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateLineItem = async (writer: PostgresJsDatabase) => {
      const [row] = await writer
        .update(invoiceLineItems)
        .set(data)
        .where(eq(invoiceLineItems.id, lineId))
        .returning()

      if (!row) {
        return null
      }

      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, row.invoiceId))
        .limit(1)

      return invoice ? { invoice, lineItem: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const updated = await updateLineItem(tx)

        if (updated) {
          await appendActionLedgerMutation(
            tx,
            buildInvoiceLineItemUpdateActionLedgerInput(
              actionLedgerContext,
              { ...updated, changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return result?.lineItem ?? null
    }

    return (await updateLineItem(db))?.lineItem ?? null
  },

  async deleteInvoiceLineItem(
    db: PostgresJsDatabase,
    lineId: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const deleteLineItem = async (writer: PostgresJsDatabase) => {
      const [row] = await writer
        .delete(invoiceLineItems)
        .where(eq(invoiceLineItems.id, lineId))
        .returning()

      if (!row) {
        return null
      }

      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, row.invoiceId))
        .limit(1)

      return invoice ? { invoice, lineItem: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const deleted = await deleteLineItem(tx)

        if (deleted) {
          await appendActionLedgerMutation(
            tx,
            buildInvoiceLineItemDeleteActionLedgerInput(actionLedgerContext, deleted, {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            }),
          )
        }

        return deleted
      })

      return result?.lineItem ?? null
    }

    return (await deleteLineItem(db))?.lineItem ?? null
  },

  listPayments(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate))
  },

  async listAllPayments(db: PostgresJsDatabase, query: PaymentListQuery) {
    // The unified view UNIONs `payments` (customer-side, FK to invoices) and
    // `supplier_payments` (FK to bookings + suppliers). Filters that only make
    // sense for one side (invoiceId / supplierId) implicitly exclude the
    // other; the explicit `kind` filter takes precedence.
    const includeCustomer = (!query.kind || query.kind === "customer") && !query.supplierId
    const includeSupplier = (!query.kind || query.kind === "supplier") && !query.invoiceId

    if (!includeCustomer && !includeSupplier) {
      return { data: [] as UnifiedPaymentRow[], total: 0, limit: query.limit, offset: query.offset }
    }

    const customerConditions = [sql`true`]
    if (query.status) customerConditions.push(sql`p.status = ${query.status}`)
    if (query.paymentMethod) customerConditions.push(sql`p.payment_method = ${query.paymentMethod}`)
    if (query.currency) customerConditions.push(sql`p.currency = ${query.currency}`)
    if (query.invoiceId) customerConditions.push(sql`p.invoice_id = ${query.invoiceId}`)
    if (query.bookingId) customerConditions.push(sql`i.booking_id = ${query.bookingId}`)
    if (query.paymentDateFrom)
      customerConditions.push(sql`p.payment_date >= ${query.paymentDateFrom}`)
    if (query.paymentDateTo) customerConditions.push(sql`p.payment_date <= ${query.paymentDateTo}`)
    if (query.search) customerConditions.push(sql`p.reference_number ILIKE ${`%${query.search}%`}`)
    const customerWhere = sql.join(customerConditions, sql` AND `)

    const supplierConditions = [sql`true`]
    if (query.status) supplierConditions.push(sql`sp.status = ${query.status}`)
    if (query.paymentMethod)
      supplierConditions.push(sql`sp.payment_method = ${query.paymentMethod}`)
    if (query.currency) supplierConditions.push(sql`sp.currency = ${query.currency}`)
    if (query.bookingId) supplierConditions.push(sql`sp.booking_id = ${query.bookingId}`)
    if (query.supplierId) supplierConditions.push(sql`sp.supplier_id = ${query.supplierId}`)
    if (query.paymentDateFrom)
      supplierConditions.push(sql`sp.payment_date >= ${query.paymentDateFrom}`)
    if (query.paymentDateTo) supplierConditions.push(sql`sp.payment_date <= ${query.paymentDateTo}`)
    if (query.search) supplierConditions.push(sql`sp.reference_number ILIKE ${`%${query.search}%`}`)
    const supplierWhere = sql.join(supplierConditions, sql` AND `)

    const customerSelect = sql`
      SELECT
        'customer'::text AS kind,
        p.id AS id,
        p.invoice_id AS invoice_id,
        i.invoice_number AS invoice_number,
        NULL::text AS booking_id,
        NULL::text AS booking_number,
        NULL::text AS supplier_id,
        NULL::text AS supplier_name,
        i.person_id AS person_id,
        pe.first_name AS person_first_name,
        pe.last_name AS person_last_name,
        i.organization_id AS organization_id,
        o.name AS organization_name,
        p.amount_cents AS amount_cents,
        p.currency AS currency,
        p.base_currency AS base_currency,
        p.base_amount_cents AS base_amount_cents,
        p.payment_method::text AS payment_method,
        p.status::text AS status,
        p.reference_number AS reference_number,
        p.payment_date AS payment_date,
        p.notes AS notes,
        p.created_at AS created_at,
        p.updated_at AS updated_at
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN people pe ON pe.id = i.person_id
      LEFT JOIN organizations o ON o.id = i.organization_id
      WHERE ${customerWhere}
    `

    const supplierSelect = sql`
      SELECT
        'supplier'::text AS kind,
        sp.id AS id,
        NULL::text AS invoice_id,
        NULL::text AS invoice_number,
        sp.booking_id AS booking_id,
        b.booking_number AS booking_number,
        sp.supplier_id AS supplier_id,
        s.name AS supplier_name,
        NULL::text AS person_id,
        NULL::text AS person_first_name,
        NULL::text AS person_last_name,
        NULL::text AS organization_id,
        NULL::text AS organization_name,
        sp.amount_cents AS amount_cents,
        sp.currency AS currency,
        sp.base_currency AS base_currency,
        sp.base_amount_cents AS base_amount_cents,
        sp.payment_method::text AS payment_method,
        sp.status::text AS status,
        sp.reference_number AS reference_number,
        sp.payment_date AS payment_date,
        sp.notes AS notes,
        sp.created_at AS created_at,
        sp.updated_at AS updated_at
      FROM supplier_payments sp
      LEFT JOIN bookings b ON b.id = sp.booking_id
      LEFT JOIN suppliers s ON s.id = sp.supplier_id
      WHERE ${supplierWhere}
    `

    const unionParts: (typeof customerSelect)[] = []
    if (includeCustomer) unionParts.push(customerSelect)
    if (includeSupplier) unionParts.push(supplierSelect)
    const unioned = sql.join(unionParts, sql` UNION ALL `)

    const sortColumn = (() => {
      switch (query.sortBy) {
        case "amountCents":
          return sql.raw("amount_cents")
        case "status":
          return sql.raw("status")
        case "paymentDate":
          return sql.raw("payment_date")
        default:
          return sql.raw("created_at")
      }
    })()
    const sortDirSql = query.sortDir === "asc" ? sql.raw("ASC") : sql.raw("DESC")

    const dataResult = await db.execute(sql`
      SELECT * FROM (${unioned}) all_payments
      ORDER BY ${sortColumn} ${sortDirSql}, created_at DESC
      LIMIT ${query.limit}
      OFFSET ${query.offset}
    `)

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM (${unioned}) all_payments
    `)

    const rows = dataResult as unknown as Array<RawUnifiedPaymentRow>
    const total = (countResult as unknown as Array<{ count: number }>)[0]?.count ?? 0
    const data: UnifiedPaymentRow[] = rows.map(mapRawPayment)

    return {
      data,
      total,
      limit: query.limit,
      offset: query.offset,
    }
  },

  /**
   * Resolve a unified payment by id. Dispatches by typeid prefix:
   * `pay_*` lives in `payments` (customer side), `spay_*` in `supplier_payments`.
   * Returns the same enriched row shape as `listAllPayments` so callers can
   * share a single record schema.
   */
  async getPaymentById(db: PostgresJsDatabase, id: string): Promise<UnifiedPaymentRow | null> {
    if (id.startsWith("spay_")) {
      const result = await db.execute(sql`
        SELECT
          'supplier'::text AS kind,
          sp.id AS id,
          NULL::text AS invoice_id,
          NULL::text AS invoice_number,
          sp.booking_id AS booking_id,
          b.booking_number AS booking_number,
          sp.supplier_id AS supplier_id,
          s.name AS supplier_name,
          NULL::text AS person_id,
          NULL::text AS person_first_name,
          NULL::text AS person_last_name,
          NULL::text AS organization_id,
          NULL::text AS organization_name,
          sp.amount_cents AS amount_cents,
          sp.currency AS currency,
          sp.base_currency AS base_currency,
          sp.base_amount_cents AS base_amount_cents,
          sp.payment_method::text AS payment_method,
          sp.status::text AS status,
          sp.reference_number AS reference_number,
          sp.payment_date AS payment_date,
          sp.notes AS notes,
          sp.created_at AS created_at,
          sp.updated_at AS updated_at
        FROM supplier_payments sp
        LEFT JOIN bookings b ON b.id = sp.booking_id
        LEFT JOIN suppliers s ON s.id = sp.supplier_id
        WHERE sp.id = ${id}
        LIMIT 1
      `)
      const row = (result as unknown as RawUnifiedPaymentRow[])[0]
      return row ? mapRawPayment(row) : null
    }

    const result = await db.execute(sql`
      SELECT
        'customer'::text AS kind,
        p.id AS id,
        p.invoice_id AS invoice_id,
        i.invoice_number AS invoice_number,
        NULL::text AS booking_id,
        NULL::text AS booking_number,
        NULL::text AS supplier_id,
        NULL::text AS supplier_name,
        i.person_id AS person_id,
        pe.first_name AS person_first_name,
        pe.last_name AS person_last_name,
        i.organization_id AS organization_id,
        o.name AS organization_name,
        p.amount_cents AS amount_cents,
        p.currency AS currency,
        p.base_currency AS base_currency,
        p.base_amount_cents AS base_amount_cents,
        p.payment_method::text AS payment_method,
        p.status::text AS status,
        p.reference_number AS reference_number,
        p.payment_date AS payment_date,
        p.notes AS notes,
        p.created_at AS created_at,
        p.updated_at AS updated_at
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN people pe ON pe.id = i.person_id
      LEFT JOIN organizations o ON o.id = i.organization_id
      WHERE p.id = ${id}
      LIMIT 1
    `)
    const row = (result as unknown as RawUnifiedPaymentRow[])[0]
    return row ? mapRawPayment(row) : null
  },

  async createPayment(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreatePaymentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)

    if (!invoice) {
      return null
    }

    assertPaymentCanSettleInvoice(invoice.currency, data)

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
        .select({ total: paymentSettlementAmountSql(invoice.currency) })
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

      if (payment && runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          await buildRecordPaymentActionLedgerInput(
            runtime.actionLedgerContext,
            {
              invoice,
              payment,
            },
            {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            },
          ),
        )
      }

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

  async createCreditNote(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateCreditNoteInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)

    if (!invoice) {
      return null
    }

    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(creditNotes)
        .values({ ...data, invoiceId })
        .returning()

      if (row && runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          await buildCreditNoteCreationActionLedgerInput(
            runtime.actionLedgerContext,
            {
              invoice,
              creditNote: row,
            },
            {
              authorizationSource: runtime.actionLedgerAuthorizationSource,
            },
          ),
        )
      }

      return row
    })
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

  async bindInvoiceRendition(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: BindInvoiceRenditionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
          invoiceType: invoices.invoiceType,
        })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)

      if (!invoice) return { status: "not_found" as const }

      if (data.replaceExisting) {
        await tx
          .update(invoiceRenditions)
          .set({ status: "stale", updatedAt: new Date() })
          .where(
            and(
              eq(invoiceRenditions.invoiceId, invoiceId),
              eq(invoiceRenditions.format, data.format),
              ne(invoiceRenditions.status, "stale"),
            ),
          )
      }

      const [rendition] = await tx
        .insert(invoiceRenditions)
        .values({
          invoiceId,
          templateId: data.templateId ?? null,
          format: data.format,
          status: "ready",
          storageKey: data.storageKey?.trim() || null,
          fileSize: data.fileSize ?? null,
          checksum: data.checksum ?? null,
          language: data.language ?? null,
          generatedAt: toTimestamp(data.generatedAt),
          metadata: {
            ...(data.metadata ?? {}),
            contentType: data.contentType,
          },
        })
        .returning()

      if (!rendition) return { status: "not_found" as const }

      return { status: "bound" as const, invoice, rendition }
    })

    if (result.status !== "bound") {
      return result
    }

    await runtime.eventBus?.emit(
      "invoice.rendered",
      {
        invoiceId: result.invoice.id,
        invoiceStatus: result.invoice.status,
        invoiceType: result.invoice.invoiceType,
        renditionId: result.rendition.id,
        format: result.rendition.format,
        storageKey: result.rendition.storageKey,
        contentType: data.contentType,
        byteSize: result.rendition.fileSize,
        contentHash: result.rendition.checksum,
      } satisfies InvoiceRenderedEvent,
      {
        category: "internal",
        source: "service",
      },
    )

    return result
  },

  async deleteInvoiceRendition(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(invoiceRenditions)
      .where(eq(invoiceRenditions.id, id))
      .returning({ id: invoiceRenditions.id })
    return row ?? null
  },

  // ============================================================================
  // Invoice attachments
  // ============================================================================

  async listInvoiceAttachments(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(invoiceAttachments)
      .where(eq(invoiceAttachments.invoiceId, invoiceId))
      .orderBy(desc(invoiceAttachments.createdAt))
  },

  async getInvoiceAttachmentById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(invoiceAttachments)
      .where(eq(invoiceAttachments.id, id))
      .limit(1)
    return row ?? null
  },

  async createInvoiceAttachment(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateInvoiceAttachmentInput,
  ) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    if (!invoice) return null

    const [row] = await db
      .insert(invoiceAttachments)
      .values({
        invoiceId,
        kind: data.kind,
        name: data.name,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
        storageKey: data.storageKey ?? null,
        checksum: data.checksum ?? null,
        metadata: data.metadata ?? null,
      })
      .returning()
    return row ?? null
  },

  async updateInvoiceAttachment(
    db: PostgresJsDatabase,
    invoiceId: string,
    id: string,
    data: UpdateInvoiceAttachmentInput,
  ) {
    const [row] = await db
      .update(invoiceAttachments)
      .set(data)
      .where(and(eq(invoiceAttachments.id, id), eq(invoiceAttachments.invoiceId, invoiceId)))
      .returning()
    return row ?? null
  },

  async deleteInvoiceAttachment(db: PostgresJsDatabase, invoiceId: string, id: string) {
    const [row] = await db
      .delete(invoiceAttachments)
      .where(and(eq(invoiceAttachments.id, id), eq(invoiceAttachments.invoiceId, invoiceId)))
      .returning({ id: invoiceAttachments.id })
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
  // Tax classes
  // ============================================================================

  async listTaxClasses(db: PostgresJsDatabase, query: TaxClassListQuery) {
    const conditions = []
    if (query.code) conditions.push(eq(taxClasses.code, query.code))
    if (typeof query.active === "boolean") conditions.push(eq(taxClasses.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(taxClasses)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(taxClasses.updatedAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(taxClasses).where(where),
      query.limit,
      query.offset,
    )
  },

  async getTaxClassById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(taxClasses).where(eq(taxClasses.id, id)).limit(1)
    return row ?? null
  },

  async createTaxClass(db: PostgresJsDatabase, data: CreateTaxClassInput) {
    const [row] = await db
      .insert(taxClasses)
      .values({
        code: data.code,
        label: data.label,
        description: data.description ?? null,
        defaultRegimeId: data.defaultRegimeId ?? null,
        lines: data.lines ?? null,
        active: data.active,
      })
      .returning()
    return row ?? null
  },

  async updateTaxClass(db: PostgresJsDatabase, id: string, data: UpdateTaxClassInput) {
    const [row] = await db
      .update(taxClasses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxClasses.id, id))
      .returning()
    return row ?? null
  },

  async deleteTaxClass(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(taxClasses)
      .where(eq(taxClasses.id, id))
      .returning({ id: taxClasses.id })
    return row ?? null
  },

  // ============================================================================
  // Tax policy profiles
  // ============================================================================

  async listTaxPolicyProfiles(db: PostgresJsDatabase, query: TaxPolicyProfileListQuery) {
    const conditions = []
    if (query.code) conditions.push(eq(taxPolicyProfiles.code, query.code))
    if (query.jurisdiction) conditions.push(eq(taxPolicyProfiles.jurisdiction, query.jurisdiction))
    if (typeof query.active === "boolean") {
      conditions.push(eq(taxPolicyProfiles.active, query.active))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(taxPolicyProfiles)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(taxPolicyProfiles.updatedAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(taxPolicyProfiles).where(where),
      query.limit,
      query.offset,
    )
  },

  async getTaxPolicyProfileById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(taxPolicyProfiles)
      .where(eq(taxPolicyProfiles.id, id))
      .limit(1)
    return row ?? null
  },

  async createTaxPolicyProfile(db: PostgresJsDatabase, data: CreateTaxPolicyProfileInput) {
    const [row] = await db
      .insert(taxPolicyProfiles)
      .values({
        code: data.code,
        name: data.name,
        jurisdiction: data.jurisdiction ?? null,
        description: data.description ?? null,
        active: data.active,
      })
      .returning()
    return row ?? null
  },

  async updateTaxPolicyProfile(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateTaxPolicyProfileInput,
  ) {
    const [row] = await db
      .update(taxPolicyProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxPolicyProfiles.id, id))
      .returning()
    return row ?? null
  },

  async deleteTaxPolicyProfile(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(taxPolicyProfiles)
      .where(eq(taxPolicyProfiles.id, id))
      .returning({ id: taxPolicyProfiles.id })
    return row ?? null
  },

  // ============================================================================
  // Tax policy rules
  // ============================================================================

  async listTaxPolicyRules(db: PostgresJsDatabase, query: TaxPolicyRuleListQuery) {
    const conditions = []
    if (query.profileId) conditions.push(eq(taxPolicyRules.profileId, query.profileId))
    if (query.side) conditions.push(eq(taxPolicyRules.side, query.side))
    if (typeof query.active === "boolean") conditions.push(eq(taxPolicyRules.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(taxPolicyRules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(taxPolicyRules.priority), desc(taxPolicyRules.updatedAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(taxPolicyRules).where(where),
      query.limit,
      query.offset,
    )
  },

  async getTaxPolicyRuleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(taxPolicyRules).where(eq(taxPolicyRules.id, id)).limit(1)
    return row ?? null
  },

  async createTaxPolicyRule(db: PostgresJsDatabase, data: CreateTaxPolicyRuleInput) {
    const [row] = await db
      .insert(taxPolicyRules)
      .values({
        profileId: data.profileId,
        side: data.side,
        priority: data.priority,
        name: data.name,
        appliesTo: data.appliesTo,
        condition: data.condition ?? null,
        taxRegimeId: data.taxRegimeId,
        active: data.active,
      })
      .returning()
    return row ?? null
  },

  async updateTaxPolicyRule(db: PostgresJsDatabase, id: string, data: UpdateTaxPolicyRuleInput) {
    const [row] = await db
      .update(taxPolicyRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxPolicyRules.id, id))
      .returning()
    return row ?? null
  },

  async deleteTaxPolicyRule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(taxPolicyRules)
      .where(eq(taxPolicyRules.id, id))
      .returning({ id: taxPolicyRules.id })
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
