import { z } from "zod"

import { travelCreditSourceTypeSchema, travelCreditStatusSchema } from "./validation-shared.js"

/** Issue a new travel credit. Code is generated server-side when not supplied. */
export const insertTravelCreditSchema = z.object({
  code: z.string().trim().min(1).max(64).optional().nullable(),
  seriesCode: z.string().max(64).optional().nullable(),
  currency: z.string().min(3).max(3),
  amountCents: z.number().int().positive(),
  issuedToPersonId: z.string().optional().nullable(),
  issuedToOrganizationId: z.string().optional().nullable(),
  sourceType: travelCreditSourceTypeSchema,
  sourceBookingId: z.string().optional().nullable(),
  sourcePaymentId: z.string().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
})

/**
 * Update metadata. Balance (remainingAmountCents) is not in here on purpose —
 * it's only mutated via `redeem`, transactionally, with a redemption row.
 */
export const updateTravelCreditSchema = z.object({
  status: travelCreditStatusSchema.optional(),
  seriesCode: z.string().max(64).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  issuedToPersonId: z.string().optional().nullable(),
  issuedToOrganizationId: z.string().optional().nullable(),
})

/** Apply a travel credit against a booking. */
export const redeemTravelCreditSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  bookingId: z.string().min(1),
  amountCents: z.number().int().positive(),
  paymentId: z.string().optional().nullable(),
})

export const travelCreditListQuerySchema = z.object({
  status: travelCreditStatusSchema.optional(),
  seriesCode: z.string().optional(),
  issuedToPersonId: z.string().optional(),
  issuedToOrganizationId: z.string().optional(),
  search: z.string().optional(),
  hasBalance: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
