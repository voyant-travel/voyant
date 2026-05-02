import { z } from "zod"

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
])
export const paymentMethodSchema = z.enum([
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "voucher",
  "other",
])
export const paymentStatusSchema = z.enum(["pending", "completed", "failed", "refunded"])
export const paymentSessionStatusSchema = z.enum([
  "pending",
  "requires_redirect",
  "processing",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
])
export const paymentSessionTargetTypeSchema = z.enum([
  "booking",
  "order",
  "invoice",
  "booking_payment_schedule",
  "booking_guarantee",
  "flight_order",
  "other",
])
export const paymentInstrumentTypeSchema = z.enum([
  "credit_card",
  "debit_card",
  "bank_account",
  "wallet",
  "voucher",
  "direct_bill",
  "cash",
  "other",
])
export const paymentInstrumentOwnerTypeSchema = z.enum([
  "client",
  "supplier",
  "channel",
  "agency",
  "internal",
  "other",
])
export const paymentInstrumentStatusSchema = z.enum([
  "active",
  "inactive",
  "expired",
  "revoked",
  "failed_verification",
])
export const paymentAuthorizationStatusSchema = z.enum([
  "pending",
  "authorized",
  "partially_captured",
  "captured",
  "voided",
  "failed",
  "expired",
])
export const paymentCaptureStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "refunded",
  "voided",
])
export const captureModeSchema = z.enum(["automatic", "manual"])
export const creditNoteStatusSchema = z.enum(["draft", "issued", "applied"])
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
export const taxScopeSchema = z.enum(["included", "excluded", "withheld"])
export const commissionRecipientTypeSchema = z.enum([
  "channel",
  "affiliate",
  "agency",
  "agent",
  "internal",
  "supplier",
  "other",
])
export const commissionModelSchema = z.enum(["percentage", "fixed", "markup", "net"])
export const commissionStatusSchema = z.enum(["pending", "accrued", "payable", "paid", "void"])

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const voucherStatusSchema = z.enum(["active", "redeemed", "expired", "void"])
export const voucherSourceTypeSchema = z.enum([
  "refund",
  "cancellation_credit",
  "gift",
  "manual",
  "promo",
])

export const financeAggregatesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
