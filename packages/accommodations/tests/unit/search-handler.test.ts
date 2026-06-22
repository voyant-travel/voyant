import type { OwnedSearchContext } from "@voyant-travel/catalog"
import { fanOutAvailabilitySearch } from "@voyant-travel/catalog"
import type {
  AvailabilityCandidate,
  AvailabilitySearchRequest,
  SourceAdapter,
} from "@voyant-travel/catalog/adapter/contract"
import { describe, expect, it } from "vitest"
import {
  type AccommodationSearchMatch,
  createAccommodationOwnedSearchHandler,
  nightsBetween,
} from "../../src/booking-engine/index.js"

const REQUEST: AvailabilitySearchRequest = {
  vertical: "accommodations",
  criteria: {
    destination: { city: "Cairo" },
    checkIn: "2026-09-01",
    checkOut: "2026-09-04",
    rooms: [{ adults: 2 }],
  },
  criteriaVersion: "accommodations/v1",
  scope: { locale: "en-GB", audience: "staff", market: "GB", currency: "USD" },
}

function match(overrides: Partial<AccommodationSearchMatch> = {}): AccommodationSearchMatch {
  return {
    accommodationId: "hrmt_std",
    roomTypeId: "rt_1",
    ratePlanId: "rp_1",
    occupancy: { adults: 2 },
    price: { amount: "450.00", currency: "USD" },
    ...overrides,
  }
}

const ctx = {} as OwnedSearchContext

describe("nightsBetween", () => {
  it("counts whole nights and floors to at least 1", () => {
    expect(nightsBetween("2026-09-01", "2026-09-04")).toBe(3)
    expect(nightsBetween("2026-09-01", "2026-09-01")).toBe(1)
  })
  it("throws on invalid dates", () => {
    expect(() => nightsBetween("nope", "2026-09-04")).toThrow()
  })
})

describe("createAccommodationOwnedSearchHandler", () => {
  it("maps bridge matches to candidates and passes nights/scope through", async () => {
    let received: { nights?: number; scope?: unknown } = {}
    const handler = createAccommodationOwnedSearchHandler({
      searchBridge: async (_c, input) => {
        received = { nights: input.nights, scope: input.scope }
        return { matches: [match()], nextCursor: "owned_cur_2" }
      },
    })

    const result = await handler.searchAvailability(ctx, REQUEST)

    expect(received.nights).toBe(3)
    expect(result.status).toBe("ok")
    expect(result.next_cursor).toBe("owned_cur_2")
    const candidate = result.candidates[0]
    expect(candidate?.entity_module).toBe("accommodations")
    expect(candidate?.entity_id).toBe("hrmt_std")
    expect(candidate?.price).toEqual({ amount: "450.00", currency: "USD" })
    expect(candidate?.selection).toMatchObject({
      roomTypeId: "rt_1",
      ratePlanId: "rp_1",
      checkIn: "2026-09-01",
      checkOut: "2026-09-04",
    })
    // Deterministic composed ref when the bridge doesn't supply one.
    expect(candidate?.candidateRef).toBe("hrmt_std:rt_1:rp_1:2026-09-01:2026-09-04")
  })

  it("reports empty when the bridge finds nothing", async () => {
    const handler = createAccommodationOwnedSearchHandler({
      searchBridge: async () => ({ matches: [] }),
    })
    const result = await handler.searchAvailability(ctx, REQUEST)
    expect(result.status).toBe("empty")
    expect(result.candidates).toHaveLength(0)
  })

  it("rejects criteria missing checkIn/checkOut/rooms", async () => {
    const handler = createAccommodationOwnedSearchHandler({
      searchBridge: async () => ({ matches: [] }),
    })
    await expect(
      handler.searchAvailability(ctx, { ...REQUEST, criteria: { rooms: [{ adults: 2 }] } }),
    ).rejects.toThrow(/checkIn/)
  })

  it("lands owned candidates in the same ranked list as sourced supply (fan-out)", async () => {
    const handler = createAccommodationOwnedSearchHandler({
      searchBridge: async () => ({
        matches: [match({ price: { amount: "150.00", currency: "USD" } })],
      }),
    })
    const sourced: SourceAdapter = {
      kind: "bedbank",
      capabilities: {
        verticals: ["accommodations"],
        supportsLiveResolution: true,
        supportsAvailabilitySearch: true,
        supportsDriftDetection: false,
        supportsBookingForwarding: false,
        postBookOperations: [],
      },
      async searchAvailability() {
        const c: AvailabilityCandidate = {
          candidateRef: "src_1",
          entity_module: "accommodations",
          entity_id: "acc_src",
          selection: {},
          price: { amount: "300.00", currency: "USD" },
        }
        return { candidates: [c], status: "ok" }
      },
    }

    const result = await fanOutAvailabilitySearch({
      adapters: [{ connectionId: "conn_bedbank", adapter: sourced }],
      ownedHandlers: [{ handler, context: ctx }],
      request: REQUEST,
    })

    // Cheaper owned candidate ranks first; both present; owned origin stamped.
    expect(result.candidates.map((c) => c.entity_id)).toEqual(["hrmt_std", "acc_src"])
    const owned = result.candidates.find((c) => c.entity_id === "hrmt_std")
    expect(owned?.source).toEqual({ kind: "owned", module: "accommodations" })
  })
})
