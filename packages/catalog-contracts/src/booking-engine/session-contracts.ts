import { z } from "zod"

import { pricingBreakdownV1 } from "./draft-contracts.js"
import { bookingLifecycleCommitOutcomeV1 } from "./lifecycle-conformance.js"

export const bookingSessionActorKindV1 = z.enum(["anonymous", "customer", "staff", "partner"])
export type BookingSessionActorKindV1 = z.infer<typeof bookingSessionActorKindV1>

export const bookingSessionTargetKindV1 = z.enum(["product", "catalog_item"])
export type BookingSessionTargetKindV1 = z.infer<typeof bookingSessionTargetKindV1>

export const bookingSessionTargetV1 = z.object({
  kind: bookingSessionTargetKindV1,
  productId: z.string().min(1).optional(),
  catalogItemId: z.string().min(1).optional(),
})
export type BookingSessionTargetV1 = z.infer<typeof bookingSessionTargetV1>

export const bookingSessionStateV1 = z.enum(["active", "consumed", "expired", "abandoned"])
export type BookingSessionStateV1 = z.infer<typeof bookingSessionStateV1>

export const bookingSessionRecordV1 = z.object({
  id: z.string().min(1),
  capability: z.string().min(16).optional(),
  target: bookingSessionTargetV1,
  actorKind: bookingSessionActorKindV1,
  state: bookingSessionStateV1,
  revision: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type BookingSessionRecordV1 = z.infer<typeof bookingSessionRecordV1>

export const createBookingSessionV1 = z.object({
  target: bookingSessionTargetV1,
  actorKind: bookingSessionActorKindV1.default("anonymous"),
  expiresAt: z.string().datetime().optional(),
  ttlMs: z.number().int().positive().optional(),
  state: z.record(z.string(), z.unknown()).optional(),
})
export type CreateBookingSessionV1 = z.input<typeof createBookingSessionV1>

export const updateBookingSessionV1 = z.object({
  capability: z.string().min(16).optional(),
  expectedRevision: z.number().int().positive(),
  state: z.record(z.string(), z.unknown()),
})
export type UpdateBookingSessionV1 = z.input<typeof updateBookingSessionV1>

export const quoteBookingSessionV1 = z.object({
  capability: z.string().min(16).optional(),
  expectedRevision: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(128).optional(),
})
export type QuoteBookingSessionV1 = z.input<typeof quoteBookingSessionV1>

export const bookingQuoteStateV1 = z.enum(["active", "superseded", "consumed", "expired"])
export type BookingQuoteStateV1 = z.infer<typeof bookingQuoteStateV1>

export const bookingQuoteRecordV1 = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sessionRevision: z.number().int().positive(),
  state: bookingQuoteStateV1,
  pricing: pricingBreakdownV1,
  quotedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
})
export type BookingQuoteRecordV1 = z.infer<typeof bookingQuoteRecordV1>

export const placeBookingHoldV1 = z.object({
  capability: z.string().min(16).optional(),
  expectedRevision: z.number().int().positive(),
  quoteId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  idempotencyKey: z.string().min(8).max(128).optional(),
})
export type PlaceBookingHoldV1 = z.input<typeof placeBookingHoldV1>

export const bookingHoldStateV1 = z.enum(["active", "converted", "released", "expired"])
export type BookingHoldStateV1 = z.infer<typeof bookingHoldStateV1>

export const bookingHoldRecordV1 = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  quoteId: z.string().min(1),
  target: bookingSessionTargetV1,
  quantity: z.number().int().positive(),
  state: bookingHoldStateV1,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})
export type BookingHoldRecordV1 = z.infer<typeof bookingHoldRecordV1>

export const commitBookingSessionV1 = z.object({
  capability: z.string().min(16).optional(),
  expectedRevision: z.number().int().positive(),
  quoteId: z.string().min(1),
  holdId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128),
  paymentGuarantee: z
    .enum(["not_required", "established", "post_commit_authorized"])
    .default("not_required"),
})
export type CommitBookingSessionV1 = z.input<typeof commitBookingSessionV1>

export const bookingSessionLifecycleErrorV1 = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("revision_conflict"),
    expectedRevision: z.number().int().positive(),
    actualRevision: z.number().int().positive(),
  }),
  z.object({ kind: z.literal("session_expired") }),
  z.object({ kind: z.literal("session_consumed") }),
  z.object({ kind: z.literal("capability_required") }),
  z.object({
    kind: z.literal("quote_required"),
    nextAction: z.literal("request_fresh_quote"),
  }),
  z.object({
    kind: z.enum(["quote_expired", "quote_superseded"]),
    nextAction: z.literal("request_fresh_quote"),
  }),
  z.object({
    kind: z.enum(["hold_required", "hold_expired", "availability_changed"]),
    nextAction: z.literal("request_new_hold"),
  }),
  z.object({
    kind: z.literal("commit_already_consumed"),
    nextAction: z.literal("return_idempotent_result"),
  }),
])
export type BookingSessionLifecycleErrorV1 = z.infer<typeof bookingSessionLifecycleErrorV1>

export const bookingSessionOutcomeV1 = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("session_created"), session: bookingSessionRecordV1 }),
  z.object({ kind: z.literal("session_updated"), session: bookingSessionRecordV1 }),
  z.object({
    kind: z.literal("quote_created"),
    session: bookingSessionRecordV1,
    quote: bookingQuoteRecordV1,
  }),
  z.object({
    kind: z.literal("hold_created"),
    session: bookingSessionRecordV1,
    hold: bookingHoldRecordV1,
  }),
  z.object({ kind: z.literal("commit_result"), outcome: bookingLifecycleCommitOutcomeV1 }),
  z.object({ kind: z.literal("rejected"), error: bookingSessionLifecycleErrorV1 }),
])
export type BookingSessionOutcomeV1 = z.infer<typeof bookingSessionOutcomeV1>
