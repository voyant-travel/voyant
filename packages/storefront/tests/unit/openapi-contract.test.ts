import { describe, expect, it } from "vitest"

import type {
  StorefrontIntakeResponse,
  StorefrontNewsletterSubscribeResponse,
} from "../../src/validation/intake.js"
import {
  storefrontLeadIntakeEnvelopeSchema,
  storefrontNewsletterSubscribeEnvelopeSchema,
} from "../../src/validation/intake.js"
import type { StorefrontVerificationChallengeRecord } from "../../src/verification/validation.js"
import {
  storefrontVerificationConfirmResponseSchema,
  storefrontVerificationStartResponseSchema,
} from "../../src/verification/validation.js"

/**
 * Contract tests (api-route-authoring.md §17): the declared response schema is
 * the wire contract, but `@hono/zod-openapi` does not verify that the handler
 * returns that shape. Here we type each fixture as the real service-return type
 * and round-trip it through `JSON.parse(JSON.stringify(...))` — exactly what
 * `c.json(...)` does — then assert the wire response schema parses the result.
 * This catches `Date` → string drift and missing/renamed columns.
 */
function jsonRoundTrip<T>(value: T): unknown {
  return JSON.parse(JSON.stringify({ data: value }))
}

describe("storefront intake response contracts", () => {
  it("a lead intake result serializes to the documented envelope", () => {
    const result: StorefrontIntakeResponse = {
      id: "csig_123",
      personId: "per_123",
      kind: "inquiry",
      source: "website",
      status: "new",
      duplicate: false,
    }

    const parsed = storefrontLeadIntakeEnvelopeSchema.safeParse(jsonRoundTrip(result))
    expect(parsed.success).toBe(true)
  })

  it("a newsletter subscribe result serializes to the documented envelope", () => {
    const result: StorefrontNewsletterSubscribeResponse = {
      id: "csig_456",
      personId: "per_456",
      kind: "notify",
      source: "website",
      status: "new",
      duplicate: true,
      doubleOptIn: "requested",
    }

    const parsed = storefrontNewsletterSubscribeEnvelopeSchema.safeParse(jsonRoundTrip(result))
    expect(parsed.success).toBe(true)
  })
})

describe("storefront verification response contracts", () => {
  const baseRecord: StorefrontVerificationChallengeRecord = {
    id: "sfvc_123",
    channel: "email",
    destination: "traveler@example.com",
    purpose: "contact_confirmation",
    status: "pending",
    expiresAt: new Date("2026-06-23T12:00:00.000Z"),
    verifiedAt: null,
    createdAt: new Date("2026-06-23T11:00:00.000Z"),
    updatedAt: new Date("2026-06-23T11:00:00.000Z"),
  }

  it("a started challenge serializes to the documented start envelope (Date -> string)", () => {
    const parsed = storefrontVerificationStartResponseSchema.safeParse(jsonRoundTrip(baseRecord))
    expect(parsed.success).toBe(true)
  })

  it("a confirmed challenge serializes to the documented confirm envelope", () => {
    const confirmed: StorefrontVerificationChallengeRecord & { status: "verified" } = {
      ...baseRecord,
      status: "verified",
      verifiedAt: new Date("2026-06-23T11:30:00.000Z"),
    }

    const parsed = storefrontVerificationConfirmResponseSchema.safeParse(jsonRoundTrip(confirmed))
    expect(parsed.success).toBe(true)
  })

  it("rejects a record whose dates were NOT serialized (raw Date is not a wire string)", () => {
    // Guards the contract: a handler that forgot to serialize the Drizzle row
    // would emit `Date` instances, which the wire schema must reject.
    const schemaInput = { data: baseRecord }
    const parsed = storefrontVerificationStartResponseSchema.safeParse(schemaInput)
    expect(parsed.success).toBe(false)
  })
})
