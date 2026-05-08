import {
  publicBookingFinanceDocumentsSchema,
  publicBookingFinancePaymentsSchema,
  publicBookingPaymentOptionsSchema,
  publicFinanceBookingDocumentSchema,
  publicFinanceBookingPaymentSchema,
  publicFinanceDocumentLookupQuerySchema,
  publicFinanceDocumentLookupSchema,
  publicPaymentOptionsQuerySchema,
  publicPaymentSessionSchema,
  publicStartPaymentSessionSchema,
  publicValidateVoucherSchema,
  publicVoucherValidationSchema,
} from "@voyantjs/finance"
import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const arrayEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })
export const successEnvelope = z.object({ success: z.boolean() })

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
])

export const paymentStatusSchema = z.enum(["pending", "completed", "failed", "refunded"])
export const creditNoteStatusSchema = z.enum(["draft", "issued", "applied"])

export const invoiceTypeSchema = z.enum(["invoice", "proforma", "credit_note"])

export const invoiceRecordSchema = z
  .object({
    id: z.string(),
    invoiceNumber: z.string(),
    bookingId: z.string(),
    personId: z.string().nullable(),
    organizationId: z.string().nullable(),
    /**
     * `invoice` (final), `proforma` (placeholder pending bank transfer),
     * or `credit_note` (refund / cancellation). Drives the type badge
     * + filename on the booking detail page.
     */
    invoiceType: invoiceTypeSchema.optional(),
    status: invoiceStatusSchema,
    currency: z.string(),
    subtotalCents: z.number().int(),
    taxCents: z.number().int(),
    totalCents: z.number().int(),
    paidCents: z.number().int(),
    balanceDueCents: z.number().int(),
    issueDate: z.string(),
    dueDate: z.string(),
    notes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  // Permissive on extra columns the server may return (e.g.
  // `convertedFromInvoiceId`, `baseCurrency`). Adding them all to the
  // schema invites churn; passthrough lets the UI use what it needs.
  .passthrough()

export type InvoiceRecord = z.infer<typeof invoiceRecordSchema>

export const lineItemRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  description: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  totalCents: z.number().int(),
  taxRate: z.number().int().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
})

export type LineItemRecord = z.infer<typeof lineItemRecordSchema>

export const paymentRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  paymentMethod: z.string(),
  status: paymentStatusSchema,
  referenceNumber: z.string().nullable(),
  paymentDate: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type PaymentRecord = z.infer<typeof paymentRecordSchema>

export const creditNoteRecordSchema = z.object({
  id: z.string(),
  creditNoteNumber: z.string(),
  invoiceId: z.string(),
  status: creditNoteStatusSchema,
  amountCents: z.number().int(),
  currency: z.string(),
  reason: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type CreditNoteRecord = z.infer<typeof creditNoteRecordSchema>

export const financeNoteRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.string(),
})

export type FinanceNoteRecord = z.infer<typeof financeNoteRecordSchema>

export const supplierPaymentRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  supplierId: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  paymentMethod: z.string(),
  status: paymentStatusSchema,
  referenceNumber: z.string().nullable(),
  paymentDate: z.string(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
})

export type SupplierPaymentRecord = z.infer<typeof supplierPaymentRecordSchema>

export const paymentKindSchema = z.enum(["customer", "supplier"])

export const unifiedPaymentRecordSchema = z.object({
  kind: paymentKindSchema,
  id: z.string(),
  invoiceId: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  bookingId: z.string().nullable(),
  bookingNumber: z.string().nullable(),
  supplierId: z.string().nullable(),
  supplierName: z.string().nullable(),
  personId: z.string().nullable(),
  personName: z.string().nullable(),
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  baseAmountCents: z.number().int().nullable(),
  paymentMethod: z.string(),
  status: paymentStatusSchema,
  referenceNumber: z.string().nullable(),
  paymentDate: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UnifiedPaymentRecord = z.infer<typeof unifiedPaymentRecordSchema>

export const paymentScheduleTypeSchema = z.enum([
  "deposit",
  "installment",
  "balance",
  "hold",
  "other",
])

export const paymentScheduleStatusSchema = z.enum([
  "pending",
  "due",
  "paid",
  "waived",
  "cancelled",
  "expired",
])

export const bookingPaymentScheduleRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  bookingItemId: z.string().nullable(),
  scheduleType: paymentScheduleTypeSchema,
  status: paymentScheduleStatusSchema,
  dueDate: z.string(),
  currency: z.string(),
  amountCents: z.number().int(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BookingPaymentScheduleRecord = z.infer<typeof bookingPaymentScheduleRecordSchema>

export const bookingPaymentSchedulesResponse = arrayEnvelope(bookingPaymentScheduleRecordSchema)

export const guaranteeTypeSchema = z.enum([
  "deposit",
  "credit_card",
  "preauth",
  "card_on_file",
  "bank_transfer",
  "voucher",
  "agency_letter",
  "other",
])

export const guaranteeStatusSchema = z.enum([
  "pending",
  "active",
  "released",
  "failed",
  "cancelled",
  "expired",
])

export const bookingGuaranteeRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  bookingPaymentScheduleId: z.string().nullable(),
  bookingItemId: z.string().nullable(),
  guaranteeType: guaranteeTypeSchema,
  status: guaranteeStatusSchema,
  currency: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  provider: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  guaranteedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  releasedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BookingGuaranteeRecord = z.infer<typeof bookingGuaranteeRecordSchema>

export const bookingGuaranteesResponse = arrayEnvelope(bookingGuaranteeRecordSchema)

export const invoiceListResponse = paginatedEnvelope(invoiceRecordSchema)
export const supplierPaymentListResponse = paginatedEnvelope(supplierPaymentRecordSchema)
export const allPaymentsListResponse = paginatedEnvelope(unifiedPaymentRecordSchema)
export const paymentSingleResponse = singleEnvelope(unifiedPaymentRecordSchema)
export const invoiceSingleResponse = singleEnvelope(invoiceRecordSchema)
export const invoiceLineItemsResponse = arrayEnvelope(lineItemRecordSchema)
export const invoicePaymentsResponse = arrayEnvelope(paymentRecordSchema)
export const invoiceCreditNotesResponse = arrayEnvelope(creditNoteRecordSchema)
export const invoiceNotesResponse = arrayEnvelope(financeNoteRecordSchema)

export {
  publicBookingFinanceDocumentsSchema,
  publicBookingFinancePaymentsSchema,
  publicBookingPaymentOptionsSchema,
  publicFinanceBookingDocumentSchema,
  publicFinanceBookingPaymentSchema,
  publicFinanceDocumentLookupQuerySchema,
  publicFinanceDocumentLookupSchema,
  publicPaymentOptionsQuerySchema,
  publicPaymentSessionSchema,
  publicStartPaymentSessionSchema,
  publicValidateVoucherSchema,
  publicVoucherValidationSchema,
}

export const publicBookingPaymentOptionsResponse = singleEnvelope(publicBookingPaymentOptionsSchema)
export const publicBookingFinanceDocumentsResponse = singleEnvelope(
  publicBookingFinanceDocumentsSchema,
)
export const publicFinanceDocumentLookupResponse = singleEnvelope(publicFinanceDocumentLookupSchema)
export const publicBookingFinancePaymentsResponse = singleEnvelope(
  publicBookingFinancePaymentsSchema,
)
export const publicPaymentSessionResponse = singleEnvelope(publicPaymentSessionSchema)
export const publicVoucherValidationResponse = singleEnvelope(publicVoucherValidationSchema)

export type PublicBookingPaymentOptionsRecord = z.infer<typeof publicBookingPaymentOptionsSchema>
export type PublicBookingFinanceDocumentsRecord = z.infer<
  typeof publicBookingFinanceDocumentsSchema
>
export type PublicFinanceDocumentLookupQuery = z.input<
  typeof publicFinanceDocumentLookupQuerySchema
>
export type PublicFinanceDocumentLookupRecord = z.infer<typeof publicFinanceDocumentLookupSchema>
export type PublicBookingFinancePaymentsRecord = z.infer<typeof publicBookingFinancePaymentsSchema>
export type PublicFinanceBookingDocumentRecord = z.infer<typeof publicFinanceBookingDocumentSchema>
export type PublicFinanceBookingPaymentRecord = z.infer<typeof publicFinanceBookingPaymentSchema>
export type PublicPaymentSessionRecord = z.infer<typeof publicPaymentSessionSchema>
export type PublicStartPaymentSessionInput = z.input<typeof publicStartPaymentSessionSchema>
export type PublicValidateVoucherInput = z.input<typeof publicValidateVoucherSchema>
export type PublicVoucherValidationRecord = z.infer<typeof publicVoucherValidationSchema>

// ---------- admin vouchers ----------

export const voucherStatusSchema = z.enum(["active", "redeemed", "expired", "void"])
export const voucherSourceTypeSchema = z.enum([
  "refund",
  "cancellation_credit",
  "gift",
  "manual",
  "promo",
])

export const voucherRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: voucherStatusSchema,
  currency: z.string(),
  initialAmountCents: z.number().int(),
  remainingAmountCents: z.number().int(),
  issuedToPersonId: z.string().nullable(),
  issuedToOrganizationId: z.string().nullable(),
  sourceType: voucherSourceTypeSchema,
  sourceBookingId: z.string().nullable(),
  sourcePaymentId: z.string().nullable(),
  expiresAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  issuedByUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type VoucherRecord = z.infer<typeof voucherRecordSchema>

export const voucherRedemptionRecordSchema = z.object({
  id: z.string(),
  voucherId: z.string(),
  bookingId: z.string(),
  paymentId: z.string().nullable(),
  amountCents: z.number().int(),
  createdByUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
})
export type VoucherRedemptionRecord = z.infer<typeof voucherRedemptionRecordSchema>

export const voucherDetailSchema = voucherRecordSchema.extend({
  redemptions: z.array(voucherRedemptionRecordSchema),
})
export type VoucherDetailRecord = z.infer<typeof voucherDetailSchema>

/** Result envelope for `POST /v1/finance/vouchers/:id/redeem`. */
export const voucherRedemptionResultSchema = z.object({
  voucher: voucherRecordSchema,
  redemption: voucherRedemptionRecordSchema.nullable(),
})
export type VoucherRedemptionResult = z.infer<typeof voucherRedemptionResultSchema>

export const voucherListResponse = paginatedEnvelope(voucherRecordSchema)
export const voucherDetailResponse = singleEnvelope(voucherDetailSchema)
export const voucherSingleResponse = singleEnvelope(voucherRecordSchema)
export const voucherRedemptionResponse = singleEnvelope(voucherRedemptionResultSchema)
