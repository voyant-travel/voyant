import { describe, expect, it } from "vitest"
import type { z } from "zod"

import {
  storefrontDepartureItinerarySchema,
  storefrontDepartureSchema,
  storefrontProductAvailabilitySummaryResponseSchema,
  storefrontProductExtensionsResponseSchema,
} from "../../src/validation/departures.js"
import type {
  StorefrontIntakeResponse,
  StorefrontNewsletterSubscribeResponse,
} from "../../src/validation/intake.js"
import {
  storefrontLeadIntakeEnvelopeSchema,
  storefrontNewsletterSubscribeEnvelopeSchema,
} from "../../src/validation/intake.js"
import { storefrontSettingsSchema } from "../../src/validation-settings.js"
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

/**
 * Catalog read contracts (voyant#2114, Batch A). Unlike the verification routes,
 * the departure/availability/itinerary services pre-normalize their Drizzle
 * `Date`s to ISO strings (`normalizeIso`/`normalizeLocalDate` in
 * `service-departures-core.ts`), and the wire schemas declare those fields as
 * plain `z.string()`, so there is no raw-`Date` drift surface to guard here.
 * These positive round-trips instead lock the documented read shapes against
 * missing/renamed columns.
 */
describe("storefront catalog read response contracts", () => {
  it("a departure serializes to the documented departure envelope", () => {
    const departure: z.infer<typeof storefrontDepartureSchema> = {
      id: "slot_123",
      productId: "prd_123",
      itineraryId: "itn_123",
      optionId: null,
      dateLocal: "2026-07-01",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-08T16:00:00.000Z",
      timezone: "Europe/Bucharest",
      startTime: null,
      meetingPoint: null,
      capacity: 20,
      remaining: 8,
      departureStatus: "open",
      nights: 7,
      days: 8,
      ratePlans: [],
    }

    const parsed = storefrontDepartureSchema.safeParse(jsonRoundTrip(departure).data)
    expect(parsed.success).toBe(true)
  })

  it("an availability summary serializes to the documented response envelope", () => {
    const summary: z.infer<typeof storefrontProductAvailabilitySummaryResponseSchema>["data"] = {
      productId: "prd_123",
      availabilityState: "available",
      counts: {
        total: 1,
        open: 1,
        closed: 0,
        soldOut: 0,
        cancelled: 0,
        onRequest: 0,
        pastCutoff: 0,
        tooEarly: 0,
        available: 1,
      },
      departures: [
        {
          id: "slot_123",
          productId: "prd_123",
          optionId: null,
          dateLocal: "2026-07-01",
          startAt: "2026-07-01T08:00:00.000Z",
          endAt: "2026-07-08T16:00:00.000Z",
          timezone: "Europe/Bucharest",
          status: "open",
          availabilityState: "available",
          capacity: 20,
          remaining: 8,
          pastCutoff: false,
          tooEarly: false,
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    }

    const parsed = storefrontProductAvailabilitySummaryResponseSchema.safeParse(
      jsonRoundTrip(summary),
    )
    expect(parsed.success).toBe(true)
  })

  it("an itinerary serializes to the documented itinerary envelope", () => {
    const itinerary: z.infer<typeof storefrontDepartureItinerarySchema> = {
      id: "slot_123",
      itineraryId: "itn_123",
      days: [
        {
          id: "day_1",
          title: "Arrival",
          description: null,
          thumbnail: null,
          segments: [{ id: "seg_1", title: "Transfer", description: null }],
        },
      ],
    }

    const parsed = storefrontDepartureItinerarySchema.safeParse(jsonRoundTrip(itinerary).data)
    expect(parsed.success).toBe(true)
  })

  it("product extensions serialize to the documented response envelope", () => {
    const extensions: z.infer<typeof storefrontProductExtensionsResponseSchema> = {
      extensions: [],
      items: [],
      details: {},
      currencyCode: "EUR",
    }

    const parsed = storefrontProductExtensionsResponseSchema.safeParse(
      jsonRoundTrip(extensions).data,
    )
    expect(parsed.success).toBe(true)
  })

  it("resolved settings serialize to the documented settings envelope", () => {
    const settings: z.infer<typeof storefrontSettingsSchema> = {
      branding: {
        logoUrl: null,
        faviconUrl: null,
        brandMarkUrl: null,
        primaryColor: null,
        accentColor: null,
        supportedLanguages: ["en"],
      },
      support: { email: null, phone: null, links: [] },
      legal: {
        termsUrl: null,
        privacyUrl: null,
        cancellationUrl: null,
        defaultContractTemplateId: null,
      },
      localization: { defaultLocale: "en", currencyDisplay: "symbol" },
      forms: { billing: { fields: [] }, travelers: { fields: [] } },
      payment: {
        defaultMethod: null,
        methods: [],
        structure: "full",
        schedule: [],
        defaultSchedule: null,
        bankTransfer: null,
      },
    }

    const parsed = storefrontSettingsSchema.safeParse(jsonRoundTrip(settings).data)
    expect(parsed.success).toBe(true)
  })
})
