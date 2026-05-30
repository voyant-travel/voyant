import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyantjs/action-ledger"
import { bookingItems, bookings } from "@voyantjs/bookings/schema"
import type { EventBus } from "@voyantjs/core"
import { renderStructuredTemplate } from "@voyantjs/utils/template-renderer"
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { resolveFxMoneyBaseAmount } from "./fx-money.js"
import type { InvoiceFxOptions } from "./invoice-fx.js"
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
import {
  buildBookingGuaranteeCreateActionLedgerInput,
  buildBookingGuaranteeDeleteActionLedgerInput,
  buildBookingGuaranteeUpdateActionLedgerInput,
  buildBookingPaymentScheduleCreateActionLedgerInput,
  buildBookingPaymentScheduleDeleteActionLedgerInput,
  buildBookingPaymentScheduleUpdateActionLedgerInput,
  buildCreditNoteCreationActionLedgerInput,
  buildCreditNoteLineItemCreateActionLedgerInput,
  buildCreditNoteUpdateActionLedgerInput,
  buildInvoiceDeleteActionLedgerInput,
  buildInvoiceLineItemCreateActionLedgerInput,
  buildInvoiceLineItemDeleteActionLedgerInput,
  buildInvoiceLineItemUpdateActionLedgerInput,
  buildInvoiceUpdateActionLedgerInput,
  buildPaymentAuthorizationCreateActionLedgerInput,
  buildPaymentAuthorizationDeleteActionLedgerInput,
  buildPaymentAuthorizationUpdateActionLedgerInput,
  buildPaymentCaptureCreateActionLedgerInput,
  buildPaymentCaptureDeleteActionLedgerInput,
  buildPaymentCaptureUpdateActionLedgerInput,
  buildPaymentDeleteActionLedgerInput,
  buildPaymentInstrumentCreateActionLedgerInput,
  buildPaymentInstrumentDeleteActionLedgerInput,
  buildPaymentInstrumentUpdateActionLedgerInput,
  buildPaymentSessionCancelledActionLedgerInput,
  buildPaymentSessionCompletionActionLedgerInput,
  buildPaymentSessionCreateActionLedgerInput,
  buildPaymentSessionExpiredActionLedgerInput,
  buildPaymentSessionFailedActionLedgerInput,
  buildPaymentSessionRequiresRedirectActionLedgerInput,
  buildPaymentSessionUpdateActionLedgerInput,
  buildPaymentUpdateActionLedgerInput,
  buildRecordPaymentActionLedgerInput,
  buildSupplierPaymentCreateActionLedgerInput,
  buildSupplierPaymentUpdateActionLedgerInput,
} from "./service-action-ledger.js"
import { getFinanceAggregates } from "./service-aggregates.js"
import type { InvoiceSettledEvent } from "./service-settlement.js"
import { vouchersService } from "./service-vouchers.js"

export {
  buildBookingGuaranteeCreateActionLedgerInput,
  buildBookingGuaranteeDeleteActionLedgerInput,
  buildBookingGuaranteeUpdateActionLedgerInput,
  buildBookingPaymentScheduleCreateActionLedgerInput,
  buildBookingPaymentScheduleDeleteActionLedgerInput,
  buildBookingPaymentScheduleUpdateActionLedgerInput,
  buildCreditNoteCreationActionLedgerInput,
  buildCreditNoteLineItemCreateActionLedgerInput,
  buildCreditNoteUpdateActionLedgerInput,
  buildInvoiceDeleteActionLedgerInput,
  buildInvoiceIssuedActionLedgerInput,
  buildInvoiceLineItemCreateActionLedgerInput,
  buildInvoiceLineItemDeleteActionLedgerInput,
  buildInvoiceLineItemUpdateActionLedgerInput,
  buildInvoiceUpdateActionLedgerInput,
  buildPaymentAuthorizationCreateActionLedgerInput,
  buildPaymentAuthorizationDeleteActionLedgerInput,
  buildPaymentAuthorizationUpdateActionLedgerInput,
  buildPaymentCaptureCreateActionLedgerInput,
  buildPaymentCaptureDeleteActionLedgerInput,
  buildPaymentCaptureUpdateActionLedgerInput,
  buildPaymentDeleteActionLedgerInput,
  buildPaymentInstrumentCreateActionLedgerInput,
  buildPaymentInstrumentDeleteActionLedgerInput,
  buildPaymentInstrumentUpdateActionLedgerInput,
  buildPaymentSessionCancelledActionLedgerInput,
  buildPaymentSessionCompletionActionLedgerInput,
  buildPaymentSessionCreateActionLedgerInput,
  buildPaymentSessionExpiredActionLedgerInput,
  buildPaymentSessionFailedActionLedgerInput,
  buildPaymentSessionRequiresRedirectActionLedgerInput,
  buildPaymentSessionUpdateActionLedgerInput,
  buildPaymentUpdateActionLedgerInput,
  buildRecordPaymentActionLedgerInput,
  buildSupplierPaymentCreateActionLedgerInput,
  buildSupplierPaymentUpdateActionLedgerInput,
} from "./service-action-ledger.js"

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
  updatePaymentSchema,
  updatePaymentSessionSchema,
  updateSupplierPaymentSchema,
  updateTaxClassSchema,
  updateTaxPolicyProfileSchema,
  updateTaxPolicyRuleSchema,
  updateTaxRegimeSchema,
  voidInvoiceSchema,
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
  readonly status: 400 | 409
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(
    message: string,
    details?: Record<string, unknown>,
    options: { status?: 400 | 409; code?: string } = {},
  ) {
    super(message)
    this.name = "PaymentValidationError"
    this.status = options.status ?? 400
    this.code = options.code ?? "invalid_request"
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
export type PaymentScheduleLineDescriptionFormat = NonNullable<
  CreateInvoiceFromBookingInput["paymentScheduleLineDescriptionFormat"]
>
type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>
type CreateInvoiceLineItemInput = z.infer<typeof insertInvoiceLineItemSchema>
type UpdateInvoiceLineItemInput = z.infer<typeof updateInvoiceLineItemSchema>
type CreatePaymentInput = z.infer<typeof insertPaymentSchema>
type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
type CreateCreditNoteInput = z.infer<typeof insertCreditNoteSchema>
type UpdateCreditNoteInput = z.infer<typeof updateCreditNoteSchema>
type CreateCreditNoteLineItemInput = z.infer<typeof insertCreditNoteLineItemSchema>
type CreateFinanceNoteInput = z.infer<typeof insertFinanceNoteSchema>
type InvoiceNumberSeriesListQuery = z.infer<typeof invoiceNumberSeriesListQuerySchema>
type CreateInvoiceNumberSeriesInput = z.infer<typeof insertInvoiceNumberSeriesSchema>
type UpdateInvoiceNumberSeriesInput = z.infer<typeof updateInvoiceNumberSeriesSchema>
type EnsureExternalInvoiceNumberSeriesInput = {
  provider: string
  scope: CreateInvoiceNumberSeriesInput["scope"]
  code?: string
  name: string
  externalConfigKey?: string | null
  isDefault?: boolean
  active?: boolean
  prefix?: string
  separator?: string
  padLength?: number
  resetStrategy?: CreateInvoiceNumberSeriesInput["resetStrategy"]
}
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

type InvoiceNumberScope = "invoice" | "proforma"
type InvoiceNumberAllocationErrorCode =
  | "invoice_number_series_not_found"
  | "invoice_number_series_inactive"
  | "invoice_number_series_scope_mismatch"
  | "no_active_series_for_scope"

export class InvoiceNumberAllocationError extends Error {
  readonly code: InvoiceNumberAllocationErrorCode
  readonly scope: InvoiceNumberScope
  readonly seriesId?: string

  constructor(
    code: InvoiceNumberAllocationErrorCode,
    details: { scope: InvoiceNumberScope; seriesId?: string },
  ) {
    super(code)
    this.name = "InvoiceNumberAllocationError"
    this.code = code
    this.scope = details.scope
    this.seriesId = details.seriesId
  }
}

export class ExternalInvoiceNumberSeriesCollisionError extends Error {
  readonly code = "external_invoice_number_series_code_conflict"
  readonly seriesCode: string
  readonly provider: string
  readonly scope: string
  readonly existingProvider: string | null
  readonly existingScope: string

  constructor(details: {
    seriesCode: string
    provider: string
    scope: string
    existingProvider: string | null
    existingScope: string
  }) {
    super(
      `Invoice number series code "${details.seriesCode}" already belongs to ${details.existingProvider ?? "a local series"} in scope "${details.existingScope}"`,
    )
    this.name = "ExternalInvoiceNumberSeriesCollisionError"
    this.seriesCode = details.seriesCode
    this.provider = details.provider
    this.scope = details.scope
    this.existingProvider = details.existingProvider
    this.existingScope = details.existingScope
  }
}

export class InvoiceNumberConflictError extends Error {
  readonly code = "invoice_number_conflict"
  readonly invoiceNumber: string

  constructor(invoiceNumber: string) {
    super("Invoice number already exists")
    this.name = "InvoiceNumberConflictError"
    this.invoiceNumber = invoiceNumber
  }
}

export class InvoiceFromBookingValidationError extends Error {
  readonly status = 400
  readonly code = "invalid_invoice_from_booking"
  readonly details?: Record<string, unknown>

  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "InvoiceFromBookingValidationError"
    this.details = details
  }
}

export class InvoiceLineItemsPersistenceError extends Error {
  readonly code = "invoice_line_items_not_persisted"
  readonly invoiceId: string
  readonly expectedCount: number
  readonly actualCount: number

  constructor(invoiceId: string, expectedCount: number, actualCount: number) {
    super("Invoice line items were not persisted")
    this.name = "InvoiceLineItemsPersistenceError"
    this.invoiceId = invoiceId
    this.expectedCount = expectedCount
    this.actualCount = actualCount
  }
}

/** Booking data needed for createInvoiceFromBooking — supplied by the caller (template). */
export type InvoiceFromBookingPaymentScheduleData = {
  id: string
  bookingId: string
  bookingItemId: string | null
  scheduleType: "deposit" | "installment" | "balance" | "hold" | "other"
  dueDate: string
  currency: string
  amountCents: number
}

export interface InvoiceFromBookingData {
  booking: {
    id: string
    bookingNumber: string
    personId: string | null
    organizationId: string | null
    startDate?: string | Date | null
    endDate?: string | Date | null
    sellCurrency: string
    baseCurrency: string | null
    fxRateSetId: string | null
    sellAmountCents: number | null
    baseSellAmountCents: number | null
  }
  paymentSchedule?: InvoiceFromBookingPaymentScheduleData | null
  dueDatePaymentSchedule?: InvoiceFromBookingPaymentScheduleData | null
  items: Array<{
    id: string
    title: string
    productId?: string | null
    productName?: string | null
    productNameSnapshot?: string | null
    optionNameSnapshot?: string | null
    unitNameSnapshot?: string | null
    departureLabelSnapshot?: string | null
    startDate?: string | Date | null
    serviceDate?: string | Date | null
    startsAt?: string | Date | null
    endDate?: string | Date | null
    endsAt?: string | Date | null
    quantity: number
    unitSellAmountCents: number | null
    totalSellAmountCents: number | null
  }>
}

export interface ResolvedInvoiceLine {
  bookingItemId: string | null
  bookingPaymentScheduleId: string | null
  description: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  taxAmountCents: number
  taxRate: number | null
  sortOrder: number
}

export interface InvoiceLineDescriptionResolverInput {
  booking: InvoiceFromBookingData["booking"]
  schedule?: NonNullable<InvoiceFromBookingData["paymentSchedule"]>
  item?: InvoiceFromBookingData["items"][number]
  line: ResolvedInvoiceLine
}

export type InvoiceLineDescriptionResolver = (
  input: InvoiceLineDescriptionResolverInput,
) => string | Promise<string>

export interface InvoiceDueDateResolverInput {
  issueDate: string
  dueDate: string
  invoiceType: NonNullable<CreateInvoiceFromBookingInput["invoiceType"]>
  booking: InvoiceFromBookingData["booking"]
  bookingPaymentSchedule?: NonNullable<InvoiceFromBookingData["paymentSchedule"]>
}

export type InvoiceDueDateResolver = (
  input: InvoiceDueDateResolverInput,
) => string | Promise<string>

const PAYMENT_SCHEDULE_LINE_LABELS: Record<
  NonNullable<InvoiceFromBookingData["paymentSchedule"]>["scheduleType"],
  string
> = {
  deposit: "Deposit",
  installment: "Installment",
  balance: "Balance",
  hold: "Hold",
  other: "Payment schedule",
}

function bookingItemToInvoiceLine(
  item: InvoiceFromBookingData["items"][number],
  taxes: Array<typeof bookingItemTaxLines.$inferSelect>,
  sortOrder: number,
): ResolvedInvoiceLine {
  const quantity = Math.max(item.quantity, 1)
  const totalCents =
    item.totalSellAmountCents ?? (item.unitSellAmountCents ?? 0) * Math.max(item.quantity, 1)
  const firstTaxWithRate = taxes.find(
    (tax) => tax.scope !== "withheld" && tax.rateBasisPoints != null,
  )

  return {
    bookingItemId: item.id,
    bookingPaymentScheduleId: null,
    description: renderBookingItemInvoiceLineDescription(item),
    quantity: item.quantity,
    unitPriceCents:
      item.unitSellAmountCents ??
      (item.totalSellAmountCents !== null && item.totalSellAmountCents !== undefined
        ? Math.floor(item.totalSellAmountCents / quantity)
        : 0),
    totalCents,
    taxAmountCents: 0,
    taxRate:
      firstTaxWithRate?.rateBasisPoints != null
        ? Math.round(firstTaxWithRate.rateBasisPoints / 100)
        : null,
    sortOrder,
  }
}

function renderBookingItemInvoiceLineDescription(item: InvoiceFromBookingData["items"][number]) {
  const base = resolveBookingItemDisplayName(item) ?? item.title
  const dates = formatInvoiceLineDateRange(
    resolveBookingItemStartDate(item),
    resolveBookingItemEndDate(item),
  )

  return dates ? `${base} | ${dates}` : base
}

function bookingPaymentScheduleToInvoiceLine(
  booking: InvoiceFromBookingData["booking"],
  schedule: NonNullable<InvoiceFromBookingData["paymentSchedule"]>,
  item: InvoiceFromBookingData["items"][number] | undefined,
  descriptionFormat: PaymentScheduleLineDescriptionFormat = "schedule_first",
): ResolvedInvoiceLine {
  const label = PAYMENT_SCHEDULE_LINE_LABELS[schedule.scheduleType]
  const percent = getPaymentSchedulePercent(booking, schedule)
  const head = percent != null && percent < 100 ? `${label} ${percent}%` : label
  const base = resolveBookingItemDisplayName(item) ?? `booking ${booking.bookingNumber}`
  const dates = formatInvoiceLineDateRange(
    item ? (resolveBookingItemStartDate(item) ?? booking.startDate) : booking.startDate,
    item ? (resolveBookingItemEndDate(item) ?? booking.endDate) : booking.endDate,
  )

  return {
    bookingItemId: schedule.bookingItemId ?? null,
    bookingPaymentScheduleId: schedule.id,
    description: renderPaymentScheduleLineDescription({ base, dates, head, descriptionFormat }),
    quantity: 1,
    unitPriceCents: schedule.amountCents,
    totalCents: schedule.amountCents,
    taxAmountCents: 0,
    taxRate: null,
    sortOrder: 0,
  }
}

function renderPaymentScheduleLineDescription(input: {
  head: string
  base: string
  dates: string | null
  descriptionFormat: PaymentScheduleLineDescriptionFormat
}) {
  switch (input.descriptionFormat) {
    case "product_only":
      return input.dates ? `${input.base} | ${input.dates}` : input.base
    case "product_first":
      return input.dates
        ? `${input.base} - ${input.head} | ${input.dates}`
        : `${input.base} - ${input.head}`
    case "schedule_first":
      return input.dates
        ? `${input.head} ${input.base} | ${input.dates}`
        : `${input.head} ${input.base}`
  }
}

function resolvePaymentScheduleDisplayItem(
  schedule: NonNullable<InvoiceFromBookingData["paymentSchedule"]>,
  items: InvoiceFromBookingData["items"],
) {
  if (schedule.bookingItemId) {
    return items.find((item) => item.id === schedule.bookingItemId)
  }

  const namedItems = items.filter((item) => resolveBookingItemDisplayName(item))
  return [...(namedItems.length > 0 ? namedItems : items)].sort(
    compareBookingItemsForScheduleDisplay,
  )[0]
}

function resolveBookingItemDisplayName(item: InvoiceFromBookingData["items"][number] | undefined) {
  return (
    item?.productNameSnapshot?.trim() || item?.productName?.trim() || item?.title?.trim() || null
  )
}

function resolveBookingItemStartDate(item: InvoiceFromBookingData["items"][number]) {
  return item.startDate ?? item.serviceDate ?? item.startsAt
}

function resolveBookingItemEndDate(item: InvoiceFromBookingData["items"][number]) {
  return item.endDate ?? item.endsAt ?? item.serviceDate ?? resolveBookingItemStartDate(item)
}

function compareBookingItemsForScheduleDisplay(
  left: InvoiceFromBookingData["items"][number],
  right: InvoiceFromBookingData["items"][number],
) {
  return (
    compareNullableStrings(
      resolveBookingItemDateSortKey(left),
      resolveBookingItemDateSortKey(right),
    ) ||
    compareNullableStrings(
      resolveBookingItemDisplayName(left),
      resolveBookingItemDisplayName(right),
    ) ||
    left.id.localeCompare(right.id)
  )
}

function resolveBookingItemDateSortKey(item: InvoiceFromBookingData["items"][number]) {
  return (
    toDateOnly(resolveBookingItemStartDate(item)) ?? toDateOnly(resolveBookingItemEndDate(item))
  )
}

function compareNullableStrings(left: string | null, right: string | null) {
  if (left && right) return left.localeCompare(right)
  if (left) return -1
  if (right) return 1
  return 0
}

function getPaymentSchedulePercent(
  booking: InvoiceFromBookingData["booking"],
  schedule: NonNullable<InvoiceFromBookingData["paymentSchedule"]>,
) {
  if (!booking.sellAmountCents || booking.sellAmountCents <= 0) return null
  return Math.round((schedule.amountCents / booking.sellAmountCents) * 100)
}

function formatInvoiceLineDateRange(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
) {
  const start = toDateOnly(startDate)
  const end = toDateOnly(endDate)
  if (!start) return null
  if (!end || end === start) return start
  return `${start} - ${end}`
}

function toDateOnly(value: string | Date | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function invoiceFromBookingOverrideLineItems(
  lineItems: NonNullable<CreateInvoiceFromBookingInput["lineItems"]>,
): ResolvedInvoiceLine[] {
  return lineItems.map((line, sortOrder) => {
    const lineSubtotalCents = line.quantity * line.unitAmountCents
    const taxAmountCents =
      line.taxAmountCents ??
      (line.taxRateBps != null ? Math.round((lineSubtotalCents * line.taxRateBps) / 10_000) : 0)

    return {
      bookingItemId: null as string | null,
      bookingPaymentScheduleId: null as string | null,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitAmountCents,
      totalCents: lineSubtotalCents,
      taxAmountCents,
      taxRate: line.taxRateBps != null ? Math.round(line.taxRateBps / 100) : null,
      sortOrder,
    }
  })
}

async function resolveInvoiceLineDescriptions(
  lineItems: ResolvedInvoiceLine[],
  context: {
    booking: InvoiceFromBookingData["booking"]
    paymentSchedule?: NonNullable<InvoiceFromBookingData["paymentSchedule"]> | null
    items: InvoiceFromBookingData["items"]
    descriptionResolver?: InvoiceLineDescriptionResolver
  },
) {
  if (!context.descriptionResolver) return lineItems
  const scheduleItem = context.paymentSchedule
    ? resolvePaymentScheduleDisplayItem(context.paymentSchedule, context.items)
    : undefined

  return Promise.all(
    lineItems.map(async (line) => ({
      ...line,
      description:
        (await context.descriptionResolver?.({
          booking: context.booking,
          schedule: context.paymentSchedule ?? undefined,
          item: context.paymentSchedule
            ? scheduleItem
            : context.items.find((item) => item.id === line.bookingItemId),
          line,
        })) ?? line.description,
    })),
  )
}

async function resolveInvoiceFromBookingDueDate(
  data: CreateInvoiceFromBookingInput,
  bookingData: InvoiceFromBookingData,
  runtime: FinanceServiceRuntime,
) {
  if (!runtime.invoiceDueDateResolver) return data.dueDate

  const dueDate = await runtime.invoiceDueDateResolver({
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    invoiceType: data.invoiceType ?? "invoice",
    booking: bookingData.booking,
    bookingPaymentSchedule:
      bookingData.paymentSchedule ?? bookingData.dueDatePaymentSchedule ?? undefined,
  })

  if (!dueDate) {
    throw new InvoiceFromBookingValidationError(
      "Invoice due date resolver returned an empty date",
      {
        issueDate: data.issueDate,
        dueDate: data.dueDate,
      },
    )
  }

  return dueDate
}

function assertInvoiceFromBookingOverrideTotals(
  data: CreateInvoiceFromBookingInput,
  totals: { subtotalCents: number; taxCents: number; totalCents: number },
) {
  if (data.subtotalCents !== undefined && data.subtotalCents !== totals.subtotalCents) {
    throw new InvoiceFromBookingValidationError("Invoice subtotal does not match line items", {
      expectedSubtotalCents: totals.subtotalCents,
      subtotalCents: data.subtotalCents,
    })
  }

  if (data.taxCents !== undefined && data.taxCents !== totals.taxCents) {
    throw new InvoiceFromBookingValidationError("Invoice tax does not match line items", {
      expectedTaxCents: totals.taxCents,
      taxCents: data.taxCents,
    })
  }

  if (data.totalCents !== undefined && data.totalCents !== totals.totalCents) {
    throw new InvoiceFromBookingValidationError("Invoice total does not match subtotal plus tax", {
      expectedTotalCents: totals.totalCents,
      totalCents: data.totalCents,
    })
  }
}

function normalizeCurrencyCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? null
}

function invoiceFromBookingExternalRefValues(
  invoiceId: string,
  refs: NonNullable<CreateInvoiceFromBookingInput["externalRefs"]>,
) {
  return refs.map((ref) => ({
    invoiceId,
    provider: ref.provider,
    externalId: ref.externalId ?? null,
    externalNumber: ref.externalNumber ?? null,
    externalUrl: ref.externalUrl ?? null,
    status: ref.status ?? null,
    metadata: ref.metadata ?? null,
    syncedAt: toTimestamp(ref.syncedAt),
    syncError: ref.syncError ?? null,
  }))
}

function resolveBookingInvoiceBaseAmount(
  booking: InvoiceFromBookingData["booking"],
  invoiceCurrency: string,
  amountCents: number,
) {
  if (!booking.baseCurrency) return null
  if (invoiceCurrency === booking.baseCurrency) return amountCents
  if (invoiceCurrency !== booking.sellCurrency || booking.baseSellAmountCents == null) return null
  if (!booking.sellAmountCents || booking.sellAmountCents <= 0) return booking.baseSellAmountCents
  return Math.round((amountCents / booking.sellAmountCents) * booking.baseSellAmountCents)
}

function isInvoiceNumberUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; constraint?: unknown; detail?: unknown }
  if (candidate.code !== "23505") return false
  const constraint = typeof candidate.constraint === "string" ? candidate.constraint : ""
  const detail = typeof candidate.detail === "string" ? candidate.detail : ""
  return (
    constraint === "invoices_invoice_number_type_active_idx" ||
    constraint === "invoices_invoice_number_type_unique" ||
    constraint === "invoices_invoice_number_unique" ||
    constraint === "invoices_invoice_number_key" ||
    detail.includes("invoice_number")
  )
}

function toTimestamp(value?: string | null) {
  return value ? new Date(value) : null
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10)
}

function readStringMetadata(value: unknown, key: string) {
  if (value == null || typeof value !== "object") return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "string" && candidate.trim() ? candidate : null
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

function invoiceScopeForType(invoiceType: CreateInvoiceFromBookingInput["invoiceType"]) {
  return invoiceType === "proforma" ? "proforma" : "invoice"
}

function pendingExternalInvoiceNumber(scope: InvoiceNumberScope) {
  const uuid = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? randomId()
  return `PENDING-${scope.toUpperCase()}-${uuid.slice(0, 32)}`
}

function randomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(32, "0")
}

async function resolveInvoiceNumberForBooking(
  db: PostgresJsDatabase,
  data: CreateInvoiceFromBookingInput,
): Promise<{
  invoiceNumber: string
  seriesId: string | null
  sequence: number | null
  status: "draft" | "pending_external_allocation"
}> {
  const scope = invoiceScopeForType(data.invoiceType)
  if (data.invoiceNumber) {
    return {
      invoiceNumber: data.invoiceNumber,
      seriesId: data.seriesId ?? null,
      sequence: null,
      status: "draft",
    }
  }

  const series = data.seriesId
    ? await financeService.getInvoiceNumberSeriesById(db, data.seriesId)
    : await financeService.resolveDefaultInvoiceNumberSeries(db, scope)

  if (!series) {
    throw new InvoiceNumberAllocationError(
      data.seriesId ? "invoice_number_series_not_found" : "no_active_series_for_scope",
      { scope, seriesId: data.seriesId },
    )
  }
  if (!series.active) {
    throw new InvoiceNumberAllocationError("invoice_number_series_inactive", {
      scope,
      seriesId: series.id,
    })
  }
  if (series.scope !== scope) {
    throw new InvoiceNumberAllocationError("invoice_number_series_scope_mismatch", {
      scope,
      seriesId: series.id,
    })
  }

  if (series.externalProvider) {
    return {
      invoiceNumber: pendingExternalInvoiceNumber(scope),
      seriesId: series.id,
      sequence: null,
      status: "pending_external_allocation",
    }
  }

  const allocated = await financeService.allocateInvoiceNumber(db, series.id)
  if (allocated.status === "not_found") {
    throw new InvoiceNumberAllocationError("invoice_number_series_not_found", {
      scope,
      seriesId: series.id,
    })
  }
  if (allocated.status === "inactive") {
    throw new InvoiceNumberAllocationError("invoice_number_series_inactive", {
      scope,
      seriesId: series.id,
    })
  }

  return {
    invoiceNumber: allocated.formattedNumber,
    seriesId: allocated.seriesId,
    sequence: allocated.sequence,
    status: "draft",
  }
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
export interface FinanceServiceRuntime extends InvoiceFxOptions {
  eventBus?: EventBus
  actionLedgerContext?: ActionLedgerRequestContextValues
  actionLedgerAuthorizationSource?: string | null
  descriptionResolver?: InvoiceLineDescriptionResolver
  invoiceDueDateResolver?: InvoiceDueDateResolver
  paymentScheduleLineDescriptionFormat?: PaymentScheduleLineDescriptionFormat
}

export interface InvoiceVoidedEvent {
  invoiceId: string
  invoiceNumber: string
  invoiceType: (typeof invoices.$inferSelect)["invoiceType"]
  bookingId: string | null
  totalCents: number
  currency: string
  reason: string | null
  voidedAt: string
  externalProvider?: string | null
  externalNumber?: string | null
  externalSeriesName?: string | null
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

type BookingGuaranteeRecord = typeof bookingGuarantees.$inferSelect

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

/**
 * Normalize `db.execute(sql)` results across drizzle drivers.
 * `drizzle-orm/postgres-js` returns rows directly (an array), while
 * `drizzle-orm/node-postgres` (used by the operator template against a
 * local pg server) and `drizzle-orm/neon-serverless` return pg's
 * `QueryResult<T>` wrapper with `.rows`. Casting to `Array<T>` and
 * calling `.map` blows up under the wrapper shape — surface the rows
 * regardless of which driver is bound.
 */
export function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows
    return Array.isArray(rows) ? (rows as T[]) : []
  }
  return []
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

async function recomputeInvoiceTotalsAfterPaymentChange(
  tx: PostgresJsDatabase,
  invoice: typeof invoices.$inferSelect,
) {
  const [sumResult] = await tx
    .select({ total: paymentSettlementAmountSql(invoice.currency) })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoice.id), eq(payments.status, "completed")))

  const paidCents = sumResult?.total ?? 0
  const balanceDueCents = Math.max(0, invoice.totalCents - paidCents)

  let nextStatus = invoice.status
  if (invoice.status !== "void" && invoice.status !== "draft") {
    if (paidCents >= invoice.totalCents && invoice.totalCents > 0) {
      nextStatus = "paid"
    } else if (paidCents > 0) {
      nextStatus = "partially_paid"
    } else if (invoice.status === "paid" || invoice.status === "partially_paid") {
      nextStatus = "issued"
    }
  }

  await tx
    .update(invoices)
    .set({ paidCents, balanceDueCents, status: nextStatus, updatedAt: new Date() })
    .where(eq(invoices.id, invoice.id))
}

async function assertInvoiceAcceptsNewPayment(
  db: PostgresJsDatabase,
  invoice: typeof invoices.$inferSelect,
) {
  if (invoice.status !== "void") return

  let redirectInvoiceId: string | null = null
  let redirectInvoiceNumber: string | null = null
  if (invoice.invoiceType === "proforma") {
    const [successor] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.convertedFromInvoiceId, invoice.id))
      .limit(1)
    redirectInvoiceId = successor?.id ?? null
    redirectInvoiceNumber = successor?.invoiceNumber ?? null
  }

  throw new PaymentValidationError(
    redirectInvoiceId
      ? `This proforma was converted to invoice ${redirectInvoiceNumber ?? redirectInvoiceId}; record the payment there instead.`
      : `Cannot record payment against voided invoice ${invoice.id}.`,
    {
      invoiceId: invoice.id,
      ...(redirectInvoiceId ? { redirectInvoiceId, redirectInvoiceNumber } : {}),
    },
    { status: 409, code: "invoice_void" },
  )
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

function shouldNormalizeBaseAmount(data: {
  amountCents?: number | null
  currency?: string | null
  baseCurrency?: string | null
  baseAmountCents?: number | null
  fxRateSetId?: string | null
  paymentDate?: string | null
}) {
  return (
    data.amountCents !== undefined ||
    data.currency !== undefined ||
    data.baseCurrency !== undefined ||
    data.baseAmountCents !== undefined ||
    data.fxRateSetId !== undefined ||
    data.paymentDate !== undefined
  )
}

async function resolveSupplierPaymentUpdateData(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateSupplierPaymentInput,
  runtime: FinanceServiceRuntime,
): Promise<UpdateSupplierPaymentInput | null> {
  const [existing] = await db
    .select()
    .from(supplierPayments)
    .where(eq(supplierPayments.id, id))
    .limit(1)
  if (!existing) return null
  if (!shouldNormalizeBaseAmount(data)) return data

  const bookingId = data.bookingId ?? existing.bookingId
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  const normalized = await resolveFxMoneyBaseAmount(
    db,
    {
      amountCents: data.amountCents ?? existing.amountCents,
      currency: data.currency ?? existing.currency,
      baseCurrency: data.baseCurrency ?? existing.baseCurrency,
      baseAmountCents: data.baseAmountCents ?? null,
      fxRateSetId: data.fxRateSetId ?? existing.fxRateSetId,
    },
    {
      ...runtime,
      targetBaseCurrency: booking?.baseCurrency ?? null,
      fallbackFxRateSetId: booking?.fxRateSetId ?? null,
      date: data.paymentDate ?? existing.paymentDate,
    },
  )

  return {
    ...data,
    baseCurrency: normalized.baseCurrency ?? null,
    baseAmountCents: normalized.baseAmountCents ?? null,
    fxRateSetId: normalized.fxRateSetId ?? null,
  }
}

async function resolveCreditNoteUpdateData(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateCreditNoteInput,
  runtime: FinanceServiceRuntime,
): Promise<UpdateCreditNoteInput | null> {
  const [existing] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1)
  if (!existing) return null
  if (!shouldNormalizeBaseAmount(data)) return data

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, existing.invoiceId))
    .limit(1)
  if (!invoice) return null

  const normalized = await resolveFxMoneyBaseAmount(
    db,
    {
      amountCents: data.amountCents ?? existing.amountCents,
      currency: data.currency ?? existing.currency,
      baseCurrency: data.baseCurrency ?? existing.baseCurrency,
      baseAmountCents: data.baseAmountCents ?? null,
      fxRateSetId: data.fxRateSetId ?? existing.fxRateSetId,
    },
    {
      ...runtime,
      targetBaseCurrency: invoice.currency,
      fallbackFxRateSetId: invoice.fxRateSetId ?? null,
      date: new Date(),
    },
  )

  return {
    ...data,
    baseCurrency: normalized.baseCurrency ?? null,
    baseAmountCents: normalized.baseAmountCents ?? null,
    fxRateSetId: normalized.fxRateSetId ?? null,
  }
}

async function resolveInvoiceForPaymentSession(
  db: PostgresJsDatabase,
  session: typeof paymentSessions.$inferSelect,
) {
  if (session.invoiceId) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, session.invoiceId))
    return invoice ?? null
  }

  if (!session.bookingPaymentScheduleId) {
    return null
  }

  const [schedule] = await db
    .select()
    .from(bookingPaymentSchedules)
    .where(eq(bookingPaymentSchedules.id, session.bookingPaymentScheduleId))
    .limit(1)

  if (!schedule) {
    return null
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.bookingId, schedule.bookingId),
        eq(invoices.currency, schedule.currency),
        ne(invoices.status, "void"),
        gt(invoices.balanceDueCents, 0),
      ),
    )
    .orderBy(desc(invoices.createdAt))
    .limit(1)

  return invoice ?? null
}

async function assertBookingPaymentScheduleHasPaymentCoverage(
  db: PostgresJsDatabase,
  schedule: Pick<
    typeof bookingPaymentSchedules.$inferSelect,
    "id" | "bookingId" | "amountCents" | "currency"
  >,
) {
  // Sum every completed payment recorded against this booking's invoices
  // and convert to the schedule's currency:
  //   - same-currency payments contribute their `amountCents`
  //   - cross-currency payments contribute their `baseAmountCents` when
  //     `baseCurrency` matches the schedule (the BookingPaymentsSummary
  //     "FX equivalent" column already exposes this conversion to the
  //     operator, so reusing it here keeps the math consistent)
  // We then subtract any *other* schedules already flagged paid in the
  // same currency, so the operator can't double-count payments by
  // marking multiple schedules paid when only one schedule's worth of
  // money actually came in.
  const paymentRows = await db
    .select({
      amountCents: payments.amountCents,
      currency: payments.currency,
      baseCurrency: payments.baseCurrency,
      baseAmountCents: payments.baseAmountCents,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(invoices.bookingId, schedule.bookingId), eq(payments.status, "completed")))

  const totalPaidInScheduleCurrency = paymentRows.reduce((sum, payment) => {
    if (payment.currency === schedule.currency) return sum + payment.amountCents
    if (payment.baseCurrency === schedule.currency && typeof payment.baseAmountCents === "number") {
      return sum + payment.baseAmountCents
    }
    return sum
  }, 0)

  const otherPaidSchedules = await db
    .select({ amountCents: bookingPaymentSchedules.amountCents })
    .from(bookingPaymentSchedules)
    .where(
      and(
        eq(bookingPaymentSchedules.bookingId, schedule.bookingId),
        eq(bookingPaymentSchedules.status, "paid"),
        eq(bookingPaymentSchedules.currency, schedule.currency),
        ne(bookingPaymentSchedules.id, schedule.id),
      ),
    )

  const alreadyClaimed = otherPaidSchedules.reduce((sum, row) => sum + row.amountCents, 0)
  const availableCoverage = totalPaidInScheduleCurrency - alreadyClaimed

  if (availableCoverage < schedule.amountCents) {
    throw new PaymentValidationError(
      "Cannot mark booking payment schedule as paid without linked completed payment coverage",
      {
        scheduleId: schedule.id,
        bookingId: schedule.bookingId,
        requiredCents: schedule.amountCents,
        coveredCents: availableCoverage,
        currency: schedule.currency,
      },
    )
  }
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

  async createPaymentInstrument(
    db: PostgresJsDatabase,
    data: CreatePaymentInstrumentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const createInstrument = (writer: PostgresJsDatabase) =>
      writer.insert(paymentInstruments).values(data).returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createInstrument(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentInstrumentCreateActionLedgerInput(
              actionLedgerContext,
              { instrument: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row ?? null
    }

    const [row] = await createInstrument(db)
    return row ?? null
  },

  async updatePaymentInstrument(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentInstrumentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateInstrument = (writer: PostgresJsDatabase) =>
      writer
        .update(paymentInstruments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(paymentInstruments.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateInstrument(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentInstrumentUpdateActionLedgerInput(
              actionLedgerContext,
              { instrument: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateInstrument(db)
    return row ?? null
  },

  async deletePaymentInstrument(
    db: PostgresJsDatabase,
    id: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(paymentInstruments)
          .where(eq(paymentInstruments.id, id))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(paymentInstruments).where(eq(paymentInstruments.id, id))
        await appendActionLedgerMutation(
          tx,
          buildPaymentInstrumentDeleteActionLedgerInput(
            actionLedgerContext,
            { instrument: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

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

  async createPaymentSession(
    db: PostgresJsDatabase,
    data: CreatePaymentSessionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
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
    const createSession = (writer: PostgresJsDatabase) =>
      writer
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

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createSession(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            await buildPaymentSessionCreateActionLedgerInput(
              actionLedgerContext,
              { session: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row ?? null
    }

    const [row] = await createSession(db)
    return row ?? null
  },

  async updatePaymentSession(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentSessionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const target = derivePaymentSessionTarget(data)
    const updateSession = (writer: PostgresJsDatabase) =>
      writer
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

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateSession(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentSessionUpdateActionLedgerInput(
              actionLedgerContext,
              { session: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateSession(db)
    return row ?? null
  },

  async markPaymentSessionRequiresRedirect(
    db: PostgresJsDatabase,
    id: string,
    data: MarkPaymentSessionRequiresRedirectInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const markRequiresRedirect = (writer: PostgresJsDatabase) =>
      writer
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

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await markRequiresRedirect(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentSessionRequiresRedirectActionLedgerInput(
              actionLedgerContext,
              { session: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await markRequiresRedirect(db)
    return row ?? null
  },

  async failPaymentSession(
    db: PostgresJsDatabase,
    id: string,
    data: FailPaymentSessionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const failSession = (writer: PostgresJsDatabase) =>
      writer
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

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await failSession(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentSessionFailedActionLedgerInput(
              actionLedgerContext,
              { session: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await failSession(db)
    return row ?? null
  },

  async cancelPaymentSession(
    db: PostgresJsDatabase,
    id: string,
    data: CancelPaymentSessionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const cancelSession = (writer: PostgresJsDatabase) =>
      writer
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

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await cancelSession(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentSessionCancelledActionLedgerInput(
              actionLedgerContext,
              { session: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await cancelSession(db)
    return row ?? null
  },

  async expirePaymentSession(
    db: PostgresJsDatabase,
    id: string,
    data: ExpirePaymentSessionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const expireSession = (writer: PostgresJsDatabase) =>
      writer
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

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await expireSession(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentSessionExpiredActionLedgerInput(
              actionLedgerContext,
              { session: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await expireSession(db)
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
      const invoiceForPayment =
        data.status === "paid" && !paymentId
          ? await resolveInvoiceForPaymentSession(tx, session)
          : null

      if (
        data.status === "paid" &&
        session.bookingPaymentScheduleId &&
        !paymentId &&
        !invoiceForPayment
      ) {
        throw new PaymentValidationError(
          "Cannot complete a booking payment schedule session without an outstanding booking invoice",
          {
            paymentSessionId: session.id,
            bookingPaymentScheduleId: session.bookingPaymentScheduleId,
          },
        )
      }

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
            invoiceId: invoiceForPayment?.id ?? session.invoiceId ?? null,
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
            invoiceId: invoiceForPayment?.id ?? session.invoiceId ?? null,
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

      if (data.status === "paid" && invoiceForPayment && !paymentId) {
        const [payment] = await tx
          .insert(payments)
          .values({
            invoiceId: invoiceForPayment.id,
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
          .where(
            and(eq(payments.invoiceId, invoiceForPayment.id), eq(payments.status, "completed")),
          )

        const paidCents = sumResult?.total ?? 0
        const balanceDueCents = Math.max(0, invoiceForPayment.totalCents - paidCents)

        await tx
          .update(invoices)
          .set({
            paidCents,
            balanceDueCents,
            status:
              paidCents >= invoiceForPayment.totalCents
                ? "paid"
                : paidCents > 0
                  ? "partially_paid"
                  : invoiceForPayment.status,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceForPayment.id))

        if (paymentId) {
          settlementForEmit = {
            invoiceId: invoiceForPayment.id,
            paymentId,
            provider: session.provider ?? "internal",
            newlyAppliedAmountCents: session.amountCents,
            paidCents,
            balanceDueCents,
          }
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
          invoiceId: invoiceForPayment?.id ?? session.invoiceId ?? undefined,
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

      if (data.status === "paid" && session.bookingPaymentScheduleId) {
        const [schedule] = await tx
          .select()
          .from(bookingPaymentSchedules)
          .where(eq(bookingPaymentSchedules.id, session.bookingPaymentScheduleId))
          .limit(1)

        if (schedule) {
          await assertBookingPaymentScheduleHasPaymentCoverage(tx, schedule)

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

          if (paidSchedule && updated) {
            bookingSchedulePaidForEmit = buildBookingPaymentSchedulePaidEvent(
              paidSchedule,
              updated,
              paymentId,
            )
          }
        }
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
    // can react without having to know the specific provider chain.
    // Some aggregate flows, such as composed trips, intentionally use a
    // generic target instead of booking/order/invoice columns; those still
    // need the completion event keyed by targetType/targetId.
    if (data.status === "paid" && txResult.updated) {
      await runtime.eventBus?.emit(
        "payment.completed",
        buildPaymentCompletedEvent(txResult.updated),
        {
          category: "domain",
          source: "service",
        },
      )
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

  async createPaymentAuthorization(
    db: PostgresJsDatabase,
    data: CreatePaymentAuthorizationInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const createAuthorization = (writer: PostgresJsDatabase) =>
      writer
        .insert(paymentAuthorizations)
        .values({
          ...data,
          authorizedAt: toTimestamp(data.authorizedAt),
          expiresAt: toTimestamp(data.expiresAt),
          voidedAt: toTimestamp(data.voidedAt),
        })
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createAuthorization(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            await buildPaymentAuthorizationCreateActionLedgerInput(
              actionLedgerContext,
              { authorization: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row ?? null
    }

    const [row] = await createAuthorization(db)
    return row ?? null
  },

  async updatePaymentAuthorization(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentAuthorizationInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateAuthorization = (writer: PostgresJsDatabase) =>
      writer
        .update(paymentAuthorizations)
        .set({
          ...data,
          authorizedAt:
            data.authorizedAt === undefined ? undefined : toTimestamp(data.authorizedAt),
          expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
          voidedAt: data.voidedAt === undefined ? undefined : toTimestamp(data.voidedAt),
          updatedAt: new Date(),
        })
        .where(eq(paymentAuthorizations.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateAuthorization(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentAuthorizationUpdateActionLedgerInput(
              actionLedgerContext,
              { authorization: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateAuthorization(db)
    return row ?? null
  },

  async deletePaymentAuthorization(
    db: PostgresJsDatabase,
    id: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(paymentAuthorizations)
          .where(eq(paymentAuthorizations.id, id))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(paymentAuthorizations).where(eq(paymentAuthorizations.id, id))
        await appendActionLedgerMutation(
          tx,
          buildPaymentAuthorizationDeleteActionLedgerInput(
            actionLedgerContext,
            { authorization: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

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

  async createPaymentCapture(
    db: PostgresJsDatabase,
    data: CreatePaymentCaptureInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const createCapture = (writer: PostgresJsDatabase) =>
      writer
        .insert(paymentCaptures)
        .values({
          ...data,
          capturedAt: toTimestamp(data.capturedAt),
          settledAt: toTimestamp(data.settledAt),
        })
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createCapture(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            await buildPaymentCaptureCreateActionLedgerInput(
              actionLedgerContext,
              { capture: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row ?? null
    }

    const [row] = await createCapture(db)
    return row ?? null
  },

  async updatePaymentCapture(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentCaptureInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateCapture = (writer: PostgresJsDatabase) =>
      writer
        .update(paymentCaptures)
        .set({
          ...data,
          capturedAt: data.capturedAt === undefined ? undefined : toTimestamp(data.capturedAt),
          settledAt: data.settledAt === undefined ? undefined : toTimestamp(data.settledAt),
          updatedAt: new Date(),
        })
        .where(eq(paymentCaptures.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateCapture(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildPaymentCaptureUpdateActionLedgerInput(
              actionLedgerContext,
              { capture: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateCapture(db)
    return row ?? null
  },

  async deletePaymentCapture(
    db: PostgresJsDatabase,
    id: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(paymentCaptures)
          .where(eq(paymentCaptures.id, id))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(paymentCaptures).where(eq(paymentCaptures.id, id))
        await appendActionLedgerMutation(
          tx,
          buildPaymentCaptureDeleteActionLedgerInput(
            actionLedgerContext,
            { capture: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

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
    runtime: FinanceServiceRuntime = {},
  ) {
    if (data.status === "paid") {
      throw new PaymentValidationError(
        "Create booking payment schedules as pending or due, then settle them through a payment session",
        { bookingId },
      )
    }

    const createSchedule = async (writer: PostgresJsDatabase) => {
      const [booking] = await writer
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)

      if (!booking) {
        return null
      }

      const [row] = await writer
        .insert(bookingPaymentSchedules)
        .values({ ...data, bookingId })
        .returning()

      return row ?? null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const row = await createSchedule(tx)

        if (row) {
          await appendActionLedgerMutation(
            tx,
            buildBookingPaymentScheduleCreateActionLedgerInput(
              actionLedgerContext,
              { schedule: row },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return row
      })
    }

    return createSchedule(db)
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
    runtime: FinanceServiceRuntime = {},
  ) {
    const applyPlan = async (writer: PostgresJsDatabase) => {
      const [booking] = await writer
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)

      if (!booking) {
        return null
      }

      const totalAmountCents = booking.sellAmountCents ?? 0
      if (totalAmountCents <= 0) {
        return {
          createdSchedules: [],
          deletedSchedules: [],
          createdGuarantee: null,
        }
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

      const clearableScheduleWhere = and(
        eq(bookingPaymentSchedules.bookingId, bookingId),
        or(
          eq(bookingPaymentSchedules.status, "pending"),
          eq(bookingPaymentSchedules.status, "due"),
        ),
      )

      const deletedSchedules = data.clearExistingPending
        ? await writer.select().from(bookingPaymentSchedules).where(clearableScheduleWhere)
        : []

      if (data.clearExistingPending) {
        await writer.delete(bookingPaymentSchedules).where(clearableScheduleWhere)
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

      const createdSchedules = await writer
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

      let createdGuarantee: BookingGuaranteeRecord | null = null
      if (data.createGuarantee) {
        const depositSchedule = createdSchedules.find(
          (schedule) => schedule.scheduleType === "deposit",
        )
        if (depositSchedule) {
          const [guarantee] = await writer
            .insert(bookingGuarantees)
            .values({
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
            .returning()
          createdGuarantee = guarantee ?? null
        }
      }

      return { createdSchedules, deletedSchedules, createdGuarantee }
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const applied = await applyPlan(tx)

        if (!applied) {
          return null
        }

        for (const schedule of applied.deletedSchedules) {
          await appendActionLedgerMutation(
            tx,
            buildBookingPaymentScheduleDeleteActionLedgerInput(
              actionLedgerContext,
              { schedule },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        for (const schedule of applied.createdSchedules) {
          await appendActionLedgerMutation(
            tx,
            buildBookingPaymentScheduleCreateActionLedgerInput(
              actionLedgerContext,
              { schedule },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        if (applied.createdGuarantee) {
          await appendActionLedgerMutation(
            tx,
            await buildBookingGuaranteeCreateActionLedgerInput(
              actionLedgerContext,
              { guarantee: applied.createdGuarantee },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return applied.createdSchedules
      })

      return result
    }

    const result = await applyPlan(db)
    return result?.createdSchedules ?? null
  },

  async updateBookingPaymentSchedule(
    db: PostgresJsDatabase,
    scheduleId: string,
    data: UpdateBookingPaymentScheduleInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateSchedule = async (writer: PostgresJsDatabase) => {
      const [existing] = await writer
        .select()
        .from(bookingPaymentSchedules)
        .where(eq(bookingPaymentSchedules.id, scheduleId))
        .limit(1)

      if (!existing) {
        return []
      }

      const nextSchedule = {
        id: existing.id,
        bookingId: existing.bookingId,
        amountCents: data.amountCents ?? existing.amountCents,
        currency: data.currency ?? existing.currency,
      }
      const nextStatus = data.status ?? existing.status

      if (nextStatus === "paid") {
        await assertBookingPaymentScheduleHasPaymentCoverage(writer, nextSchedule)
      }

      return writer
        .update(bookingPaymentSchedules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(bookingPaymentSchedules.id, scheduleId))
        .returning()
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateSchedule(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildBookingPaymentScheduleUpdateActionLedgerInput(
              actionLedgerContext,
              { schedule: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateSchedule(db)
    return row ?? null
  },

  async deleteBookingPaymentSchedule(
    db: PostgresJsDatabase,
    scheduleId: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(bookingPaymentSchedules)
          .where(eq(bookingPaymentSchedules.id, scheduleId))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(bookingPaymentSchedules).where(eq(bookingPaymentSchedules.id, scheduleId))
        await appendActionLedgerMutation(
          tx,
          buildBookingPaymentScheduleDeleteActionLedgerInput(
            actionLedgerContext,
            { schedule: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

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
    runtime: FinanceServiceRuntime = {},
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

    return this.createPaymentSession(
      db,
      {
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
      },
      runtime,
    )
  },

  async createPaymentSessionFromInvoice(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreatePaymentSessionFromInvoiceInput,
    runtime: FinanceServiceRuntime = {},
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

    return this.createPaymentSession(
      db,
      {
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
      },
      runtime,
    )
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
    runtime: FinanceServiceRuntime = {},
  ) {
    const createGuarantee = async (writer: PostgresJsDatabase) => {
      const [booking] = await writer
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)

      if (!booking) {
        return null
      }

      const [row] = await writer
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
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const row = await createGuarantee(tx)

        if (row) {
          await appendActionLedgerMutation(
            tx,
            await buildBookingGuaranteeCreateActionLedgerInput(
              actionLedgerContext,
              { guarantee: row },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return row
      })
    }

    return createGuarantee(db)
  },

  async createPaymentSessionFromBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    data: CreatePaymentSessionFromGuaranteeInput,
    runtime: FinanceServiceRuntime = {},
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

    return this.createPaymentSession(
      db,
      {
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
      },
      runtime,
    )
  },

  async updateBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    data: UpdateBookingGuaranteeInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateGuarantee = (writer: PostgresJsDatabase) =>
      writer
        .update(bookingGuarantees)
        .set({
          ...data,
          guaranteedAt:
            data.guaranteedAt === undefined ? undefined : toTimestamp(data.guaranteedAt),
          expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
          releasedAt: data.releasedAt === undefined ? undefined : toTimestamp(data.releasedAt),
          updatedAt: new Date(),
        })
        .where(eq(bookingGuarantees.id, guaranteeId))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updateGuarantee(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildBookingGuaranteeUpdateActionLedgerInput(
              actionLedgerContext,
              { guarantee: updated[0], changes: data },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updateGuarantee(db)
    return row ?? null
  },

  async deleteBookingGuarantee(
    db: PostgresJsDatabase,
    guaranteeId: string,
    runtime: FinanceServiceRuntime = {},
  ) {
    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(bookingGuarantees)
          .where(eq(bookingGuarantees.id, guaranteeId))
          .limit(1)

        if (!existing) {
          return null
        }

        await tx.delete(bookingGuarantees).where(eq(bookingGuarantees.id, guaranteeId))
        await appendActionLedgerMutation(
          tx,
          buildBookingGuaranteeDeleteActionLedgerInput(
            actionLedgerContext,
            { guarantee: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )

        return { id: existing.id }
      })
    }

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

  async createSupplierPayment(
    db: PostgresJsDatabase,
    data: CreateSupplierPaymentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, data.bookingId))
      .limit(1)
    const paymentData = await resolveFxMoneyBaseAmount(db, data, {
      ...runtime,
      targetBaseCurrency: booking?.baseCurrency ?? null,
      fallbackFxRateSetId: booking?.fxRateSetId ?? null,
      date: data.paymentDate,
    })
    const createPayment = (writer: PostgresJsDatabase) =>
      writer
        .insert(supplierPayments)
        .values({ ...paymentData, paymentInstrumentId: paymentData.paymentInstrumentId ?? null })
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const created = await createPayment(tx)

        if (created[0]) {
          await appendActionLedgerMutation(
            tx,
            await buildSupplierPaymentCreateActionLedgerInput(
              actionLedgerContext,
              { payment: created[0] },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return created
      })

      return row
    }

    const [row] = await createPayment(db)
    return row
  },

  async updateSupplierPayment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateSupplierPaymentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateData = await resolveSupplierPaymentUpdateData(db, id, data, runtime)
    if (!updateData) return null

    const updatePayment = (writer: PostgresJsDatabase) =>
      writer
        .update(supplierPayments)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(supplierPayments.id, id))
        .returning()

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const [row] = await db.transaction(async (tx) => {
        const updated = await updatePayment(tx)

        if (updated[0]) {
          await appendActionLedgerMutation(
            tx,
            buildSupplierPaymentUpdateActionLedgerInput(
              actionLedgerContext,
              { payment: updated[0], changes: updateData },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return row ?? null
    }

    const [row] = await updatePayment(db)
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

    // For each returned invoice, surface the distinct
    // `bookingPaymentScheduleId`s referenced by its line items so the
    // booking-detail payment-schedule table can link rows to invoices
    // without a second roundtrip. Returns `[]` when an invoice covers
    // booking items directly (no schedule link).
    const invoiceIds = rows.map((row) => row.id)
    const scheduleLinks = invoiceIds.length
      ? await db
          .select({
            invoiceId: invoiceLineItems.invoiceId,
            bookingPaymentScheduleId: invoiceLineItems.bookingPaymentScheduleId,
          })
          .from(invoiceLineItems)
          .where(
            and(
              inArray(invoiceLineItems.invoiceId, invoiceIds),
              isNotNull(invoiceLineItems.bookingPaymentScheduleId),
            ),
          )
      : []
    const scheduleIdsByInvoice = new Map<string, string[]>()
    for (const link of scheduleLinks) {
      const scheduleId = link.bookingPaymentScheduleId
      if (!scheduleId) continue
      const existing = scheduleIdsByInvoice.get(link.invoiceId)
      if (!existing) {
        scheduleIdsByInvoice.set(link.invoiceId, [scheduleId])
      } else if (!existing.includes(scheduleId)) {
        existing.push(scheduleId)
      }
    }
    const data = rows.map((row) => ({
      ...row,
      bookingPaymentScheduleIds: scheduleIdsByInvoice.get(row.id) ?? [],
    }))

    return {
      data,
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
    runtime: FinanceServiceRuntime = {},
  ) {
    const { booking, items, paymentSchedule } = bookingData
    const invoiceDueDate = await resolveInvoiceFromBookingDueDate(data, bookingData, runtime)
    const requestedCurrency = normalizeCurrencyCode(data.currency)
    const bookingSellCurrency = normalizeCurrencyCode(booking.sellCurrency) ?? booking.sellCurrency
    const invoiceCurrency =
      requestedCurrency ?? normalizeCurrencyCode(paymentSchedule?.currency) ?? bookingSellCurrency
    const requestedBaseCurrency = normalizeCurrencyCode(data.baseCurrency)
    const hasCrossCurrencyOverride =
      requestedCurrency !== null && requestedCurrency !== bookingSellCurrency

    if (
      hasCrossCurrencyOverride &&
      (!requestedBaseCurrency || requestedBaseCurrency !== bookingSellCurrency)
    ) {
      throw new InvoiceFromBookingValidationError(
        "Cross-currency invoice overrides require baseCurrency to match the booking sell currency",
        {
          currency: invoiceCurrency,
          baseCurrency: requestedBaseCurrency,
          bookingSellCurrency,
        },
      )
    }

    const overrideLineItems = data.lineItems
      ? invoiceFromBookingOverrideLineItems(data.lineItems)
      : null

    if (hasCrossCurrencyOverride && !overrideLineItems) {
      throw new InvoiceFromBookingValidationError(
        "Cross-currency invoice overrides require replacement line items",
        {
          currency: invoiceCurrency,
          baseCurrency: requestedBaseCurrency,
          bookingSellCurrency,
          fields: ["lineItems"],
        },
      )
    }

    const shouldUseBookingItems = overrideLineItems === null && !paymentSchedule
    const invoiceItems = shouldUseBookingItems ? items : []
    const itemIds = invoiceItems.map((item) => item.id)

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

    const scheduleItem = paymentSchedule
      ? resolvePaymentScheduleDisplayItem(paymentSchedule, items)
      : undefined
    const paymentScheduleLineDescriptionFormat =
      data.paymentScheduleLineDescriptionFormat ??
      runtime.paymentScheduleLineDescriptionFormat ??
      "schedule_first"
    const resolvedLineItems =
      overrideLineItems ??
      (paymentSchedule
        ? [
            bookingPaymentScheduleToInvoiceLine(
              booking,
              paymentSchedule,
              scheduleItem,
              paymentScheduleLineDescriptionFormat,
            ),
          ]
        : invoiceItems.length > 0
          ? invoiceItems.map((item, sortOrder) => ({
              ...bookingItemToInvoiceLine(item, taxesByBookingItemId.get(item.id) ?? [], sortOrder),
            }))
          : [
              {
                bookingItemId: null as string | null,
                bookingPaymentScheduleId: null as string | null,
                description: `Booking ${booking.bookingNumber}`,
                quantity: 1,
                unitPriceCents: booking.sellAmountCents ?? 0,
                totalCents: booking.sellAmountCents ?? 0,
                taxAmountCents: 0,
                taxRate: null,
                sortOrder: 0,
              },
            ])
    const lineItems = await resolveInvoiceLineDescriptions(resolvedLineItems, {
      booking,
      paymentSchedule,
      items,
      descriptionResolver: runtime.descriptionResolver,
    })

    const grossLineTotalCents = lineItems.reduce((sum, line) => sum + line.totalCents, 0)
    const includedTaxCents = overrideLineItems
      ? 0
      : taxes.reduce((sum, tax) => {
          if (tax.scope === "withheld" || !tax.includedInPrice) return sum
          return sum + tax.amountCents
        }, 0)
    const excludedTaxCents = overrideLineItems
      ? overrideLineItems.reduce((sum, line) => sum + line.taxAmountCents, 0)
      : taxes.reduce((sum, tax) => {
          if (tax.scope === "withheld" || tax.includedInPrice) return sum
          return sum + tax.amountCents
        }, 0)
    const subtotalCents = Math.max(0, grossLineTotalCents - includedTaxCents)
    const taxCents = includedTaxCents + excludedTaxCents
    const totalCents = subtotalCents + taxCents
    assertInvoiceFromBookingOverrideTotals(data, { subtotalCents, taxCents, totalCents })
    const commissionAmountCents = overrideLineItems
      ? 0
      : commissions.reduce((sum, commission) => {
          return sum + (commission.amountCents ?? 0)
        }, 0)

    // The `ck_invoices_base_currency_amounts` constraint requires
    // that whenever ANY base_*_cents column is non-null, base_currency
    // must be set too. Resolve the base side once and propagate nulls
    // consistently when no booking/runtime base currency is available.
    const bookingBaseAmountCents = paymentSchedule
      ? resolveBookingInvoiceBaseAmount(booking, invoiceCurrency, paymentSchedule.amountCents)
      : (booking.baseSellAmountCents ?? null)
    const invoiceBaseCurrency = requestedBaseCurrency ?? booking.baseCurrency ?? null
    const invoiceFxRateSetId = data.fxRateSetId ?? booking.fxRateSetId ?? null
    const resolvedInvoiceBase = await resolveFxMoneyBaseAmount(
      db,
      {
        amountCents: totalCents,
        currency: invoiceCurrency,
        baseCurrency: invoiceBaseCurrency,
        baseAmountCents: hasCrossCurrencyOverride ? null : bookingBaseAmountCents,
        fxRateSetId: invoiceFxRateSetId,
      },
      {
        ...runtime,
        targetBaseCurrency: invoiceBaseCurrency,
        fallbackFxRateSetId: invoiceFxRateSetId,
        date: data.issueDate,
        setBaseCurrencyWhenUnresolved: Boolean(invoiceBaseCurrency),
      },
    )
    const resolvedBaseCurrency = resolvedInvoiceBase.baseCurrency ?? null
    const invoiceBaseAmountCents = resolvedInvoiceBase.baseAmountCents ?? null
    const hasBaseCurrency = Boolean(resolvedBaseCurrency)

    if (hasCrossCurrencyOverride && invoiceBaseAmountCents === null) {
      throw new InvoiceFromBookingValidationError(
        "Cross-currency invoice overrides require a resolvable base total",
        {
          currency: invoiceCurrency,
          baseCurrency: requestedBaseCurrency,
          fxRateSetId: invoiceFxRateSetId,
        },
      )
    }

    const numberAssignment = await resolveInvoiceNumberForBooking(db, data)

    try {
      return await db.transaction(async (tx) => {
        const [invoice] = await tx
          .insert(invoices)
          .values({
            invoiceNumber: numberAssignment.invoiceNumber,
            invoiceType: data.invoiceType,
            seriesId: numberAssignment.seriesId,
            sequence: numberAssignment.sequence,
            bookingId: booking.id,
            personId: booking.personId,
            organizationId: booking.organizationId,
            status: numberAssignment.status,
            currency: invoiceCurrency,
            baseCurrency: resolvedBaseCurrency,
            fxRateSetId: resolvedInvoiceBase.fxRateSetId ?? null,
            subtotalCents,
            baseSubtotalCents: hasBaseCurrency ? invoiceBaseAmountCents : null,
            taxCents,
            baseTaxCents: null,
            totalCents,
            baseTotalCents: hasBaseCurrency ? invoiceBaseAmountCents : null,
            paidCents: 0,
            basePaidCents: hasBaseCurrency ? 0 : null,
            balanceDueCents: totalCents,
            baseBalanceDueCents: hasBaseCurrency ? invoiceBaseAmountCents : null,
            commissionAmountCents: commissionAmountCents > 0 ? commissionAmountCents : null,
            issueDate: data.issueDate,
            dueDate: invoiceDueDate,
            notes: data.notes ?? null,
          })
          .returning()

        if (!invoice) {
          return null
        }

        if (data.externalRefs?.length) {
          await tx
            .insert(invoiceExternalRefs)
            .values(invoiceFromBookingExternalRefValues(invoice.id, data.externalRefs))
        }

        const lineItemValues = lineItems.map((line) => ({
          invoiceId: invoice.id,
          bookingItemId: line.bookingItemId,
          bookingPaymentScheduleId: line.bookingPaymentScheduleId,
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.totalCents,
          taxRate: line.taxRate,
          sortOrder: line.sortOrder,
        }))
        const insertedLineItems = await tx
          .insert(invoiceLineItems)
          .values(lineItemValues)
          .returning({ id: invoiceLineItems.id })
        if (insertedLineItems.length !== lineItemValues.length) {
          throw new InvoiceLineItemsPersistenceError(
            invoice.id,
            lineItemValues.length,
            insertedLineItems.length,
          )
        }

        return invoice
      })
    } catch (error) {
      if (isInvoiceNumberUniqueConstraintError(error)) {
        throw new InvoiceNumberConflictError(numberAssignment.invoiceNumber)
      }
      throw error
    }
  },

  async getInvoiceById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
    if (!row) return null
    // Surface the proforma → final-invoice link so the UI can show
    // "Invoiced" instead of "Void" for proformas that were converted.
    // The reverse direction (`convertedFromInvoiceId`) already lives on
    // the row; this looks up the inverse via the unique
    // `idx_invoices_converted_from` index.
    const [convertedTo] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.convertedFromInvoiceId, id), ne(invoices.status, "void")))
      .limit(1)
    return {
      ...row,
      convertedToInvoiceId: convertedTo?.id ?? null,
      convertedToInvoiceNumber: convertedTo?.invoiceNumber ?? null,
    }
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

    try {
      const actionLedgerContext = runtime.actionLedgerContext
      if (actionLedgerContext) {
        return await db.transaction(async (tx) => {
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
    } catch (error) {
      if (data.invoiceNumber && isInvoiceNumberUniqueConstraintError(error)) {
        throw new InvoiceNumberConflictError(data.invoiceNumber)
      }
      throw error
    }
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

  async voidInvoice(
    db: PostgresJsDatabase,
    id: string,
    input: VoidInvoiceInput = {},
    runtime: FinanceServiceRuntime = {},
  ) {
    const reason = input.reason?.trim() || null
    const voidedAt = new Date()
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1)

      if (!existing) {
        return { status: "not_found" as const }
      }

      if (existing.status === "void") {
        return { status: "already_void" as const, invoice: existing }
      }

      if (existing.status === "draft") {
        return { status: "draft" as const, invoice: existing }
      }

      const voidableStatuses = new Set<typeof existing.status>([
        "pending_external_allocation",
        "issued",
        "partially_paid",
        "overdue",
      ])

      if (!voidableStatuses.has(existing.status)) {
        return { status: "invalid_status" as const, invoice: existing }
      }

      const [payment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.invoiceId, id))
        .limit(1)

      if (payment) {
        return { status: "has_payments" as const, invoice: existing }
      }

      const [creditNote] = await tx
        .select({ id: creditNotes.id })
        .from(creditNotes)
        .where(eq(creditNotes.invoiceId, id))
        .limit(1)

      if (creditNote) {
        return { status: "has_credit_notes" as const, invoice: existing }
      }

      const changes = {
        status: "void" as const,
        voidedAt,
        voidReason: reason,
        balanceDueCents: 0,
        baseBalanceDueCents: existing.baseBalanceDueCents == null ? null : 0,
        updatedAt: voidedAt,
      }
      const actionLedgerChanges: UpdateInvoiceInput = {
        status: "void",
        balanceDueCents: changes.balanceDueCents,
        baseBalanceDueCents: changes.baseBalanceDueCents,
      }
      const [invoice] = await tx
        .update(invoices)
        .set(changes)
        .where(eq(invoices.id, id))
        .returning()

      if (!invoice) {
        return { status: "not_found" as const }
      }

      const actionLedgerContext = runtime.actionLedgerContext
      if (actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          buildInvoiceUpdateActionLedgerInput(
            actionLedgerContext,
            { invoice, changes: actionLedgerChanges },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }

      return { status: "voided" as const, invoice }
    })

    if (result.status === "voided" && runtime.eventBus) {
      const [smartbillRef] = await db
        .select()
        .from(invoiceExternalRefs)
        .where(
          and(
            eq(invoiceExternalRefs.invoiceId, result.invoice.id),
            eq(invoiceExternalRefs.provider, "smartbill"),
          ),
        )
        .orderBy(desc(invoiceExternalRefs.createdAt))
        .limit(1)
      const [externalRef] = smartbillRef
        ? [smartbillRef]
        : await db
            .select()
            .from(invoiceExternalRefs)
            .where(eq(invoiceExternalRefs.invoiceId, result.invoice.id))
            .orderBy(desc(invoiceExternalRefs.createdAt))
            .limit(1)
      const [series] = result.invoice.seriesId
        ? await db
            .select({ name: invoiceNumberSeries.name })
            .from(invoiceNumberSeries)
            .where(eq(invoiceNumberSeries.id, result.invoice.seriesId))
            .limit(1)
        : []

      const event: InvoiceVoidedEvent = {
        invoiceId: result.invoice.id,
        invoiceNumber: result.invoice.invoiceNumber,
        invoiceType: result.invoice.invoiceType,
        bookingId: result.invoice.bookingId,
        totalCents: result.invoice.totalCents,
        currency: result.invoice.currency,
        reason,
        voidedAt: result.invoice.voidedAt?.toISOString() ?? voidedAt.toISOString(),
        externalProvider: externalRef?.provider ?? null,
        externalNumber: externalRef?.externalNumber ?? null,
        externalSeriesName:
          readStringMetadata(externalRef?.metadata, "seriesName") ?? series?.name ?? null,
      }
      await runtime.eventBus.emit("invoice.voided", event)
    }

    return result
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

    const rows = toRows<RawUnifiedPaymentRow>(dataResult)
    const total = toRows<{ count: number }>(countResult)[0]?.count ?? 0
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
      const row = toRows<RawUnifiedPaymentRow>(result)[0]
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
    const row = toRows<RawUnifiedPaymentRow>(result)[0]
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

    await assertInvoiceAcceptsNewPayment(db, invoice)

    const paymentData = await resolveFxMoneyBaseAmount(db, data, {
      ...runtime,
      targetBaseCurrency: invoice.currency,
      fallbackFxRateSetId: invoice.fxRateSetId ?? null,
      date: data.paymentDate,
    })

    assertPaymentCanSettleInvoice(invoice.currency, paymentData)

    return db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(payments)
        .values({
          ...paymentData,
          invoiceId,
          paymentInstrumentId: paymentData.paymentInstrumentId ?? null,
          paymentAuthorizationId: paymentData.paymentAuthorizationId ?? null,
          paymentCaptureId: paymentData.paymentCaptureId ?? null,
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

  async updatePayment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePaymentInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const [existing] = await db.select().from(payments).where(eq(payments.id, id)).limit(1)
    if (!existing) {
      return null
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, existing.invoiceId))
      .limit(1)
    if (!invoice) {
      return null
    }

    // Merge the patch onto the existing row so FX validation sees the
    // post-update settlement shape. Without this, a PATCH that flips a
    // completed payment to a non-invoice currency without supplying a
    // base amount would silently corrupt invoice totals (the row stays
    // "completed" but contributes 0 to paid_cents).
    const merged: UpdatePaymentInput & {
      amountCents: number
      currency: string
      status: typeof existing.status
      paymentDate: string
    } = {
      amountCents: data.amountCents ?? existing.amountCents,
      currency: data.currency ?? existing.currency,
      baseCurrency:
        data.baseCurrency !== undefined ? data.baseCurrency : (existing.baseCurrency ?? null),
      baseAmountCents:
        data.baseAmountCents !== undefined
          ? data.baseAmountCents
          : (existing.baseAmountCents ?? null),
      fxRateSetId:
        data.fxRateSetId !== undefined ? data.fxRateSetId : (existing.fxRateSetId ?? null),
      paymentMethod: data.paymentMethod ?? existing.paymentMethod,
      status: data.status ?? existing.status,
      paymentDate: data.paymentDate ?? existing.paymentDate,
    }

    const normalized = shouldNormalizeBaseAmount(data)
      ? await resolveFxMoneyBaseAmount(db, merged, {
          ...runtime,
          targetBaseCurrency: invoice.currency,
          fallbackFxRateSetId: invoice.fxRateSetId ?? null,
          date: merged.paymentDate,
        })
      : merged

    assertPaymentCanSettleInvoice(invoice.currency, normalized as unknown as CreatePaymentInput)

    return db.transaction(async (tx) => {
      const writePatch: Record<string, unknown> = { ...data, updatedAt: new Date() }
      // resolveFxMoneyBaseAmount may have filled in baseCurrency / baseAmountCents /
      // fxRateSetId — persist those even if the caller didn't include them.
      writePatch.baseCurrency = normalized.baseCurrency ?? null
      writePatch.baseAmountCents = normalized.baseAmountCents ?? null
      writePatch.fxRateSetId = normalized.fxRateSetId ?? null

      const [payment] = await tx
        .update(payments)
        .set(writePatch)
        .where(eq(payments.id, id))
        .returning()

      if (!payment) {
        return null
      }

      await recomputeInvoiceTotalsAfterPaymentChange(tx, invoice)

      if (runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          buildPaymentUpdateActionLedgerInput(
            runtime.actionLedgerContext,
            { invoice, payment, changes: data },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }

      return payment
    })
  },

  async deletePayment(db: PostgresJsDatabase, id: string, runtime: FinanceServiceRuntime = {}) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1)
      if (!existing) {
        return null
      }

      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, existing.invoiceId))
        .limit(1)
      if (!invoice) {
        return null
      }

      await tx.delete(payments).where(eq(payments.id, id))

      await recomputeInvoiceTotalsAfterPaymentChange(tx, invoice)

      if (runtime.actionLedgerContext) {
        await appendActionLedgerMutation(
          tx,
          buildPaymentDeleteActionLedgerInput(
            runtime.actionLedgerContext,
            { invoice, payment: existing },
            { authorizationSource: runtime.actionLedgerAuthorizationSource },
          ),
        )
      }

      return existing
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

    const creditNoteData = await resolveFxMoneyBaseAmount(db, data, {
      ...runtime,
      targetBaseCurrency: invoice.currency,
      fallbackFxRateSetId: invoice.fxRateSetId ?? null,
      date: new Date(),
    })

    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(creditNotes)
        .values({ ...creditNoteData, invoiceId })
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
    runtime: FinanceServiceRuntime = {},
  ) {
    const updateData = await resolveCreditNoteUpdateData(db, creditNoteId, data, runtime)
    if (!updateData) return null

    const updateCreditNoteRow = async (writer: PostgresJsDatabase) => {
      const [row] = await writer
        .update(creditNotes)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(creditNotes.id, creditNoteId))
        .returning()

      if (!row) {
        return null
      }

      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, row.invoiceId))
        .limit(1)

      return invoice ? { invoice, creditNote: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const updated = await updateCreditNoteRow(tx)

        if (updated) {
          await appendActionLedgerMutation(
            tx,
            buildCreditNoteUpdateActionLedgerInput(
              actionLedgerContext,
              { ...updated, changes: updateData },
              { authorizationSource: runtime.actionLedgerAuthorizationSource },
            ),
          )
        }

        return updated
      })

      return result?.creditNote ?? null
    }

    return (await updateCreditNoteRow(db))?.creditNote ?? null
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
    runtime: FinanceServiceRuntime = {},
  ) {
    const createLineItem = async (writer: PostgresJsDatabase) => {
      const [creditNote] = await writer
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.id, creditNoteId))
        .limit(1)

      if (!creditNote) {
        return null
      }

      const [invoice] = await writer
        .select()
        .from(invoices)
        .where(eq(invoices.id, creditNote.invoiceId))
        .limit(1)

      if (!invoice) {
        return null
      }

      const [row] = await writer
        .insert(creditNoteLineItems)
        .values({ ...data, creditNoteId })
        .returning()

      return row ? { invoice, creditNote, lineItem: row } : null
    }

    const actionLedgerContext = runtime.actionLedgerContext
    if (actionLedgerContext) {
      const result = await db.transaction(async (tx) => {
        const created = await createLineItem(tx)

        if (created) {
          await appendActionLedgerMutation(
            tx,
            buildCreditNoteLineItemCreateActionLedgerInput(actionLedgerContext, created, {
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

  async resolveDefaultInvoiceNumberSeries(db: PostgresJsDatabase, scope: InvoiceNumberScope) {
    const [row] = await db
      .select()
      .from(invoiceNumberSeries)
      .where(and(eq(invoiceNumberSeries.scope, scope), eq(invoiceNumberSeries.active, true)))
      .orderBy(
        desc(invoiceNumberSeries.isDefault),
        desc(invoiceNumberSeries.updatedAt),
        desc(invoiceNumberSeries.createdAt),
      )
      .limit(1)
    return row ?? null
  },

  async ensureExternalInvoiceNumberSeries(
    db: PostgresJsDatabase,
    inputs: EnsureExternalInvoiceNumberSeriesInput[],
  ) {
    return db.transaction(async (tx) => {
      const rows: Array<typeof invoiceNumberSeries.$inferSelect> = []

      for (const input of inputs) {
        const now = new Date()
        const code = input.code ?? `${input.provider}-${input.scope}`
        const active = input.active ?? true
        const isDefault = active === false ? false : (input.isDefault ?? true)

        const [existingExternal] = await tx
          .select()
          .from(invoiceNumberSeries)
          .where(
            and(
              eq(invoiceNumberSeries.scope, input.scope),
              eq(invoiceNumberSeries.externalProvider, input.provider),
            ),
          )
          .orderBy(
            desc(invoiceNumberSeries.isDefault),
            desc(invoiceNumberSeries.updatedAt),
            desc(invoiceNumberSeries.createdAt),
          )
          .limit(1)

        const [existingByCode] = existingExternal
          ? [null]
          : await tx
              .select()
              .from(invoiceNumberSeries)
              .where(eq(invoiceNumberSeries.code, code))
              .limit(1)
        if (
          existingByCode &&
          (existingByCode.scope !== input.scope ||
            existingByCode.externalProvider !== input.provider)
        ) {
          throw new ExternalInvoiceNumberSeriesCollisionError({
            seriesCode: code,
            provider: input.provider,
            scope: input.scope,
            existingProvider: existingByCode.externalProvider,
            existingScope: existingByCode.scope,
          })
        }
        const existing = existingExternal ?? existingByCode
        const nextCode = existingExternal ? existingExternal.code : code

        if (isDefault) {
          const defaultScopeWhere = existing
            ? and(
                eq(invoiceNumberSeries.scope, input.scope),
                ne(invoiceNumberSeries.id, existing.id),
              )
            : eq(invoiceNumberSeries.scope, input.scope)
          await tx
            .update(invoiceNumberSeries)
            .set({ isDefault: false, updatedAt: now })
            .where(defaultScopeWhere)
        }

        if (existing) {
          const [row] = await tx
            .update(invoiceNumberSeries)
            .set({
              code: nextCode,
              name: input.name,
              prefix: input.prefix ?? existing.prefix,
              separator: input.separator ?? existing.separator,
              padLength: input.padLength ?? existing.padLength,
              resetStrategy: input.resetStrategy ?? existing.resetStrategy,
              scope: input.scope,
              isDefault,
              externalProvider: input.provider,
              externalConfigKey: input.externalConfigKey ?? null,
              active,
              updatedAt: now,
            })
            .where(eq(invoiceNumberSeries.id, existing.id))
            .returning()
          if (row) rows.push(row)
          continue
        }

        const [row] = await tx
          .insert(invoiceNumberSeries)
          .values({
            code,
            name: input.name,
            prefix: input.prefix ?? "",
            separator: input.separator ?? "",
            padLength: input.padLength ?? 0,
            currentSequence: 0,
            resetStrategy: input.resetStrategy ?? "never",
            resetAt: null,
            scope: input.scope,
            isDefault,
            externalProvider: input.provider,
            externalConfigKey: input.externalConfigKey ?? null,
            active,
          })
          .returning()
        if (row) rows.push(row)
      }

      return rows
    })
  },

  async createInvoiceNumberSeries(db: PostgresJsDatabase, data: CreateInvoiceNumberSeriesInput) {
    return db.transaction(async (tx) => {
      const isDefault = data.active === false ? false : data.isDefault

      if (isDefault) {
        await tx
          .update(invoiceNumberSeries)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(invoiceNumberSeries.scope, data.scope))
      }

      const [row] = await tx
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
          isDefault,
          externalProvider: data.externalProvider ?? null,
          externalConfigKey: data.externalConfigKey ?? null,
          active: data.active,
        })
        .returning()
      return row ?? null
    })
  },

  async updateInvoiceNumberSeries(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateInvoiceNumberSeriesInput,
  ) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoiceNumberSeries)
        .where(eq(invoiceNumberSeries.id, id))
        .limit(1)
      if (!existing) return null

      const { resetAt, ...rest } = data
      const nextScope = rest.scope ?? existing.scope
      const nextActive = rest.active ?? existing.active
      const nextIsDefault = nextActive === false ? false : (rest.isDefault ?? existing.isDefault)

      if (nextIsDefault) {
        await tx
          .update(invoiceNumberSeries)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(invoiceNumberSeries.scope, nextScope), ne(invoiceNumberSeries.id, id)))
      }

      const [row] = await tx
        .update(invoiceNumberSeries)
        .set({
          ...rest,
          isDefault: nextIsDefault,
          ...(resetAt !== undefined ? { resetAt: toTimestamp(resetAt) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(invoiceNumberSeries.id, id))
        .returning()
      return row ?? null
    })
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

  async applyExternalInvoiceAllocation(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: { invoiceNumber: string; status?: "issued" | "draft" },
  ) {
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
    if (!existing) return { status: "not_found" as const }
    if (existing.status !== "pending_external_allocation") {
      return { status: "not_pending_external_allocation" as const, invoice: existing }
    }

    let invoice: typeof invoices.$inferSelect | undefined
    try {
      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          invoiceNumber: data.invoiceNumber,
          status: data.status ?? "issued",
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning()
      invoice = updatedInvoice
    } catch (error) {
      if (isInvoiceNumberUniqueConstraintError(error)) {
        throw new InvoiceNumberConflictError(data.invoiceNumber)
      }
      throw error
    }

    return invoice ? { status: "applied" as const, invoice } : { status: "not_found" as const }
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
