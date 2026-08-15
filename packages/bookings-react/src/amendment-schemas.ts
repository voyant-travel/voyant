import { z } from "zod"

/**
 * Client-side shapes for the Booking Amendment admin surface.
 *
 * Declared here rather than imported from `@voyant-travel/bookings-contracts`
 * for the same reason the rest of this package declares its own: the server
 * package pulls Drizzle and Hono through value imports, which browser bundles
 * must not reach (`verify:boundary`). Only the fields the operator UI renders
 * are modelled; unknown keys are ignored by zod, so the server may add more.
 */

export const bookingAmendmentStatusSchema = z.enum([
  "proposed",
  "accepted",
  "applying",
  "applied",
  "rejected",
  "failed",
  "in_doubt",
  "manual_review",
])

export type BookingAmendmentStatus = z.infer<typeof bookingAmendmentStatusSchema>

export const bookingAmendmentKindSchema = z.enum([
  "traveler_correction",
  "traveler_add",
  "traveler_drop",
])

export type BookingAmendmentKind = z.infer<typeof bookingAmendmentKindSchema>

export const bookingAmendmentNextActionSchema = z.enum([
  "accept",
  "apply",
  "wait_supplier",
  "reconcile_supplier",
  "manual_review",
  "collect_payment",
  "issue_refund",
  "reissue_documents",
])

export type BookingAmendmentNextAction = z.infer<typeof bookingAmendmentNextActionSchema>

export const bookingAmendmentPriceSchema = z.object({
  currency: z.string(),
  subtotalDeltaCents: z.number().int(),
  feeDeltaCents: z.number().int(),
  taxDeltaCents: z.number().int(),
  amountCents: z.number().int(),
  collectionAmountCents: z.number().int(),
  refundAmountCents: z.number().int(),
})

export const bookingAmendmentEffectsSchema = z.object({
  finance: z.string(),
  legal: z.string(),
  documents: z.string(),
  fulfillment: z.string(),
  supplier: z.string(),
  allocation: z.string(),
})

export type BookingAmendmentEffects = z.infer<typeof bookingAmendmentEffectsSchema>

export const bookingAmendmentRevisionSchema = z.object({
  id: z.string(),
  role: z.enum(["before", "proposed_after"]),
  bookingRevision: z.number().int(),
})

export const bookingAmendmentRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  travelerId: z.string(),
  kind: bookingAmendmentKindSchema,
  status: bookingAmendmentStatusSchema,
  baseBookingRevision: z.number().int(),
  resultBookingRevision: z.number().int(),
  acceptanceRequired: z.boolean(),
  priceDelta: bookingAmendmentPriceSchema,
  effects: bookingAmendmentEffectsSchema,
  nextActions: z.array(bookingAmendmentNextActionSchema),
  quotedAt: z.string(),
  quoteExpiresAt: z.string().nullable(),
  failureCode: z.string().nullable(),
  reason: z.string(),
  appliedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revisions: z.array(bookingAmendmentRevisionSchema).optional(),
})

export type BookingAmendmentRecord = z.infer<typeof bookingAmendmentRecordSchema>

/**
 * A preview can come back as a real amendment, or as one of several
 * "nothing to quote" outcomes. The server distinguishes them by HTTP
 * status (201 vs 200) and by the presence of `data.amendment`.
 */
export const bookingAmendmentPreviewResponse = z.union([
  z.object({ data: z.object({ amendment: bookingAmendmentRecordSchema }) }),
  z.object({
    data: z.object({
      status: z.string(),
      bookingId: z.string().optional(),
      bookingRevision: z.number().int().optional(),
    }),
  }),
])

export const bookingAmendmentResponse = z.object({ data: bookingAmendmentRecordSchema })
export const bookingAmendmentListResponse = z.object({
  data: z.array(bookingAmendmentRecordSchema),
})

/** True when the amendment still needs an operator to do something. */
export function amendmentIsOpen(amendment: BookingAmendmentRecord): boolean {
  return (
    amendment.status !== "applied" &&
    amendment.status !== "rejected" &&
    amendment.status !== "failed"
  )
}
