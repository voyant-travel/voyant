/** Booking-engine request and response V1 schemas. */

import { z } from "zod"

import { bookingDraftShapeV1, bookingDraftV1, pricingBreakdownV1 } from "./draft-contracts.js"

// ─────────────────────────────────────────────────────────────────
// Engine request / response contracts
// ─────────────────────────────────────────────────────────────────

export const quoteScopeV1 = z.object({
  locale: z.string(),
  audience: z.enum(["staff", "customer", "partner", "supplier"]),
  market: z.string(),
  currency: z.string().optional(),
})

export const quoteRequestV1 = z.object({
  entityModule: z.string(),
  entityId: z.string(),
  sourceKind: z.string(),
  sourceConnectionId: z.string().optional(),
  sourceRef: z.string().optional(),
  scope: quoteScopeV1,
  draft: bookingDraftV1.optional(),
  ttlMs: z.number().int().positive().optional(),
})

export const quoteResponseV1 = z.object({
  quoteId: z.string(),
  quotedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  available: z.boolean(),
  invalidReason: z.string().optional(),
  shape: bookingDraftShapeV1.optional(),
  pricing: pricingBreakdownV1.optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Mirrors flights' `paymentIntent` discriminated union from
 * `catalog-flights-architecture.md` §3.1. Default `{ type: "hold" }`
 * when omitted. Kept in lockstep with `bookRequestV1.paymentIntent`.
 */
export type BookingPaymentIntent =
  | { type: "hold" }
  | { type: "card"; tokenizedCard: string }
  | { type: "ticket_on_credit"; agencyAccount: string }

export const bookRequestV1 = z
  .object({
    quoteId: z.string().optional(),
    draftId: z.string().optional(),
    bookingId: z.string().optional(),
    party: z.record(z.string(), z.unknown()).optional(),
    paymentIntent: z
      .union([
        z.object({ type: z.literal("hold") }),
        z.object({ type: z.literal("card"), tokenizedCard: z.string() }),
        z.object({ type: z.literal("ticket_on_credit"), agencyAccount: z.string() }),
      ])
      .optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    /** Idempotency — same key in 24h returns the existing booking. */
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((v) => v.quoteId || v.draftId, {
    message: "either quoteId or draftId must be provided",
  })

export const bookResponseV1 = z.object({
  bookingId: z.string(),
  orderRef: z.string(),
  status: z.enum(["held", "confirmed", "ticketed", "failed"]),
  snapshotId: z.string(),
  pricing: pricingBreakdownV1.optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
})

export type QuoteRequestV1 = z.infer<typeof quoteRequestV1>
export type QuoteResponseV1 = z.infer<typeof quoteResponseV1>
export type BookRequestV1 = z.infer<typeof bookRequestV1>
export type BookResponseV1 = z.infer<typeof bookResponseV1>

// ─────────────────────────────────────────────────────────────────
// Hold lifecycle as separate operations — earlier drafts buried
// hold inside reserve/cancel; making it explicit lets adapters
// expose extend semantics without faking a full reserve.
// ─────────────────────────────────────────────────────────────────

export const holdExtendRequestV1 = z.object({ holdToken: z.string() })
export const holdReleaseRequestV1 = z.object({ holdToken: z.string() })

export type HoldExtendRequestV1 = z.infer<typeof holdExtendRequestV1>
export type HoldReleaseRequestV1 = z.infer<typeof holdReleaseRequestV1>

/**
 * Capability flag a handler / adapter declares to opt into the V1
 * contracts above. The engine refuses to dispatch to a handler whose
 * declared version doesn't match the request.
 */
export const ENGINE_CONTRACT_V1 = "v1" as const
export type EngineContractVersion = typeof ENGINE_CONTRACT_V1
