import { z } from "zod"

import { paginatedEnvelope, singleEnvelope } from "./common.js"

export const travelCreditStatusSchema = z.enum(["active", "redeemed", "expired", "void"])
export const travelCreditSourceTypeSchema = z.enum([
  "refund",
  "cancellation_credit",
  "gift",
  "manual",
  "goodwill",
  "promotion",
])

export const travelCreditRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  seriesCode: z.string().nullable(),
  status: travelCreditStatusSchema,
  currency: z.string(),
  initialAmountCents: z.number().int(),
  remainingAmountCents: z.number().int(),
  issuedToPersonId: z.string().nullable(),
  issuedToOrganizationId: z.string().nullable(),
  sourceType: travelCreditSourceTypeSchema,
  sourceBookingId: z.string().nullable(),
  sourcePaymentId: z.string().nullable(),
  validFrom: z.coerce.date().nullable(),
  expiresAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  issuedByUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type TravelCreditRecord = z.infer<typeof travelCreditRecordSchema>

export const travelCreditRedemptionRecordSchema = z.object({
  id: z.string(),
  travelCreditId: z.string(),
  bookingId: z.string(),
  paymentId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  amountCents: z.number().int(),
  createdByUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
})
export type TravelCreditRedemptionRecord = z.infer<typeof travelCreditRedemptionRecordSchema>

export const travelCreditDetailSchema = travelCreditRecordSchema.extend({
  redemptions: z.array(travelCreditRedemptionRecordSchema),
})
export type TravelCreditDetailRecord = z.infer<typeof travelCreditDetailSchema>

/** Result envelope for `POST /v1/admin/finance/travel-credits/:id/redeem`. */
export const travelCreditRedemptionResultSchema = z.object({
  travelCredit: travelCreditRecordSchema,
  redemption: travelCreditRedemptionRecordSchema.nullable(),
})
export type TravelCreditRedemptionResult = z.infer<typeof travelCreditRedemptionResultSchema>

export const travelCreditListResponse = paginatedEnvelope(travelCreditRecordSchema)
export const travelCreditDetailResponse = singleEnvelope(travelCreditDetailSchema)
export const travelCreditSingleResponse = singleEnvelope(travelCreditRecordSchema)
export const travelCreditRedemptionResponse = singleEnvelope(travelCreditRedemptionResultSchema)
