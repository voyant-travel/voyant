import { describe, expect, it, vi } from "vitest"
import type { DraftPayload, MaterializationSnapshot } from "./materialization.js"
import {
  extractBookingDates,
  extractItemDates,
  extractItemDescription,
  inferSnapshotTaxFacts,
  resolveLineItemTitle,
  travelerBandToCategory,
} from "./materialization-support.js"

function snapshot(overrides: Partial<MaterializationSnapshot> = {}): MaterializationSnapshot {
  return {
    id: "snap_1",
    entity_module: "products",
    entity_id: "prod_1",
    source_kind: "demo",
    source_provider: null,
    source_ref: null,
    frozen_payload: null,
    pricing_base_amount: null,
    pricing_taxes: null,
    pricing_fees: null,
    pricing_surcharges: null,
    pricing_currency: "EUR",
    ...overrides,
  }
}

describe("travelerBandToCategory", () => {
  it("maps known bands and defaults unknowns to adult", () => {
    expect(travelerBandToCategory("child")).toBe("child")
    expect(travelerBandToCategory("infant")).toBe("infant")
    expect(travelerBandToCategory("senior")).toBe("senior")
    expect(travelerBandToCategory("adult")).toBe("adult")
    expect(travelerBandToCategory(undefined)).toBe("adult")
    expect(travelerBandToCategory("teen")).toBe("adult")
  })
})

describe("extractBookingDates", () => {
  it("prefers the draft date range when present", () => {
    const draft: DraftPayload = {
      configure: {
        dateRange: { checkIn: "2026-07-01T00:00:00Z", checkOut: "2026-07-05T00:00:00Z" },
      },
    }
    expect(extractBookingDates({ frozen_payload: null }, draft)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-05",
    })
  })

  it("falls back to a selected departure resolved from the frozen payload", () => {
    const draft: DraftPayload = { configure: { departureSlotId: "dep_9" } }
    const frozen = {
      content: {
        departures: [
          { id: "dep_9", starts_at: "2026-08-10T09:00:00Z", ends_at: "2026-08-10T17:00:00Z" },
        ],
      },
    }
    expect(extractBookingDates({ frozen_payload: frozen }, draft)).toEqual({
      startDate: "2026-08-10",
      endDate: "2026-08-10",
    })
  })

  it("falls back to a single departureDate", () => {
    const draft: DraftPayload = { configure: { departureDate: "2026-09-02T00:00:00Z" } }
    expect(extractBookingDates({ frozen_payload: null }, draft)).toEqual({
      startDate: "2026-09-02",
      endDate: null,
    })
  })

  it("returns nulls when nothing resolves", () => {
    expect(extractBookingDates({ frozen_payload: null }, {})).toEqual({
      startDate: null,
      endDate: null,
    })
  })
})

describe("extractItemDates", () => {
  const booking = { startDate: null, endDate: null } as never

  it("resolves the selected departure first", () => {
    const draft: DraftPayload = { configure: { departureSlotId: "dep_1" } }
    const snap = snapshot({
      frozen_payload: {
        reserve: {
          departure: {
            id: "dep_1",
            startsAt: "2026-07-01T08:00:00Z",
            endsAt: "2026-07-01T18:00:00Z",
          },
        },
      },
    })
    const out = extractItemDates(snap, draft, booking)
    expect(out.serviceDate).toBe("2026-07-01")
    expect(out.startsAt?.toISOString()).toBe("2026-07-01T08:00:00.000Z")
    expect(out.endsAt?.toISOString()).toBe("2026-07-01T18:00:00.000Z")
  })

  it("falls back to upstream metadata.days[]", () => {
    const snap = snapshot({
      frozen_payload: {
        quote: {
          upstream_payload: {
            metadata: {
              days: [{ date: "2026-06-01T00:00:00Z" }, { date: "2026-06-03T00:00:00Z" }],
            },
          },
        },
      },
    })
    const out = extractItemDates(snap, {}, booking)
    expect(out.serviceDate).toBe("2026-06-01")
    expect(out.endsAt?.toISOString()).toBe("2026-06-03T00:00:00.000Z")
  })

  it("falls back to booking row dates last", () => {
    const out = extractItemDates(snapshot(), {}, {
      startDate: "2026-05-05",
      endDate: "2026-05-09",
    } as never)
    expect(out.serviceDate).toBe("2026-05-05")
    expect(out.startsAt?.toISOString().slice(0, 10)).toBe("2026-05-05")
  })

  it("returns nulls when nothing resolves", () => {
    expect(extractItemDates(snapshot(), {}, booking)).toEqual({
      serviceDate: null,
      startsAt: null,
      endsAt: null,
    })
  })
})

describe("inferSnapshotTaxFacts", () => {
  it("detects accommodation countries in the frozen content", () => {
    const snap = snapshot({
      frozen_payload: {
        content: {
          items: [
            { type: "accommodation", countryCode: "ro" },
            { type: "transfer", country: "fr" },
          ],
        },
      },
    })
    const facts = inferSnapshotTaxFacts(snap)
    expect(facts.hasAccommodation).toBe(true)
    expect(facts.accommodationCountries).toEqual(["RO"])
  })

  it("returns no accommodation when none present", () => {
    expect(inferSnapshotTaxFacts(snapshot())).toEqual({
      hasAccommodation: false,
      accommodationCountries: [],
    })
  })
})

describe("extractItemDescription", () => {
  it("pulls + caps the upstream description", () => {
    const long = "x".repeat(700)
    const snap = snapshot({
      frozen_payload: { quote: { upstream_payload: { description: long } } },
    })
    const out = extractItemDescription(snap)
    expect(out).not.toBeNull()
    expect(out?.length).toBe(598)
    expect(out?.endsWith("…")).toBe(true)
  })

  it("returns null when no description", () => {
    expect(extractItemDescription(snapshot())).toBeNull()
  })
})

describe("resolveLineItemTitle", () => {
  it("returns the sourced projection name when present", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ projection: { name: "Northern Lights Hunt" } }] }),
        }),
      }),
    } as never
    const title = await resolveLineItemTitle(db, snapshot(), {
      getOwnedProductName: vi.fn(),
    })
    expect(title).toBe("Northern Lights Hunt")
  })

  it("falls back to the injected owned-product name", async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    } as never
    const getOwnedProductName = vi.fn().mockResolvedValue("Owned Tour")
    const title = await resolveLineItemTitle(db, snapshot(), { getOwnedProductName })
    expect(title).toBe("Owned Tour")
    expect(getOwnedProductName).toHaveBeenCalledWith(db, "products", "prod_1")
  })

  it("falls back to the generic module label", async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    } as never
    const title = await resolveLineItemTitle(db, snapshot({ entity_module: "cruises" }), {
      getOwnedProductName: vi.fn().mockResolvedValue(null),
    })
    expect(title).toBe("cruises booking")
  })
})
