import { z } from "zod"

import { paginatedEnvelope, singleEnvelope } from "./common.js"

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

/** Result envelope for `POST /v1/admin/finance/vouchers/:id/redeem`. */
export const voucherRedemptionResultSchema = z.object({
  voucher: voucherRecordSchema,
  redemption: voucherRedemptionRecordSchema.nullable(),
})
export type VoucherRedemptionResult = z.infer<typeof voucherRedemptionResultSchema>

export const voucherListResponse = paginatedEnvelope(voucherRecordSchema)
export const voucherDetailResponse = singleEnvelope(voucherDetailSchema)
export const voucherSingleResponse = singleEnvelope(voucherRecordSchema)
export const voucherRedemptionResponse = singleEnvelope(voucherRedemptionResultSchema)
