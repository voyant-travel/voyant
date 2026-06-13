import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { SellabilityOfferBundleInput, SellabilityOfferWriter } from "../../src/index.js"
import { createSellabilityService } from "../../src/service.js"

function createMockDb() {
  const returning = vi.fn().mockResolvedValue([{ id: "sell_snap_1" }])
  const values = vi
    .fn()
    .mockImplementationOnce(() => ({ returning }))
    .mockImplementationOnce(() => Promise.resolve([]))
  const insert = vi.fn().mockReturnValue({ values })

  return {
    db: { insert } as never,
    insert,
    values,
    returning,
  }
}

describe("sellabilityService.constructOffer", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("resolves a candidate and materializes a normalized offer bundle", async () => {
    const { db, insert, values, returning } = createMockDb()
    const createOfferBundle = vi.fn(
      async (_db: PostgresJsDatabase, _input: SellabilityOfferBundleInput) => ({
        offer: { id: "offer_1", offerNumber: "OFF-1" },
        travelers: [],
        contactAssignments: [],
        items: [],
        itemTravelers: [],
      }),
    )
    const updateOfferMetadata = vi.fn(async () => ({
      id: "offer_1",
      metadata: {
        sellability: {
          snapshotId: "sell_snap_1",
        },
      },
    }))
    const service = createSellabilityService({
      offerWriter: {
        createOfferBundle,
        updateOfferMetadata,
      } satisfies SellabilityOfferWriter,
    })

    vi.spyOn(service, "resolve").mockResolvedValue({
      data: [
        {
          product: { id: "prod_1", name: "City Escape" },
          option: { id: "opt_1", name: "Private Tour", code: "PRIVATE" },
          slot: {
            id: "slot_1",
            productId: "prod_1",
            optionId: "opt_1",
            startTimeId: "start_1",
            dateLocal: "2026-06-01",
            startsAt: new Date("2026-06-01T09:00:00.000Z"),
            timezone: "Europe/Bucharest",
            unlimited: false,
            remainingPax: 6,
            remainingPickups: 3,
            pastCutoff: false,
            tooEarly: false,
          },
          market: { id: "market_1", code: "ro", name: "Romania" },
          channel: { id: "channel_1", kind: "direct" },
          sellability: {
            mode: "sellable",
            onRequest: false,
            allotmentStatus: "sellable",
          },
          pricing: {
            currencyCode: "EUR",
            sellAmountCents: 21000,
            costAmountCents: 14500,
            marginAmountCents: 6500,
            breakdown: [],
            components: [
              {
                kind: "unit",
                title: "Private Tour · Adult",
                quantity: 2,
                pricingMode: "per_person",
                sellAmountCents: 16000,
                costAmountCents: 10000,
                unitId: "unit_adult",
                unitName: "Adult",
                unitType: "person",
                pricingCategoryId: "pc_adult",
                pricingCategoryName: "Adult",
                requestRef: "adult-2",
                sourceRuleId: "rule_unit_1",
                tierId: null,
              },
              {
                kind: "unit",
                title: "Private Tour · Child",
                quantity: 1,
                pricingMode: "per_person",
                sellAmountCents: 3000,
                costAmountCents: 2500,
                unitId: "unit_child",
                unitName: "Child",
                unitType: "person",
                pricingCategoryId: "pc_child",
                pricingCategoryName: "Child",
                requestRef: "child-1",
                sourceRuleId: "rule_unit_2",
                tierId: null,
              },
              {
                kind: "pickup",
                title: "Pickup",
                quantity: 1,
                pricingMode: "per_booking",
                sellAmountCents: 2000,
                costAmountCents: 2000,
                unitId: null,
                unitName: null,
                unitType: null,
                pricingCategoryId: null,
                pricingCategoryName: null,
                requestRef: null,
                sourceRuleId: "pickup_rule_1",
                tierId: null,
              },
            ],
            fx: {
              fxRateSetId: "fx_1",
              baseCurrency: "USD",
              quoteCurrency: "EUR",
              rateDecimal: 0.92,
            },
          },
          sources: {
            marketProductRuleId: "mpr_1",
            marketChannelRuleId: "mcr_1",
            marketPriceCatalogId: "mpc_1",
            optionPriceRuleId: "opr_1",
            optionStartTimeRuleId: null,
            channelInventoryAllotmentIds: ["allot_1"],
            channelInventoryReleaseRuleId: "release_1",
          },
        },
      ],
      meta: { total: 1 },
    })

    const result = await service.constructOffer(db, {
      query: {
        productId: "prod_1",
        optionId: "opt_1",
        slotId: "slot_1",
        marketId: "market_1",
        channelId: "channel_1",
        requestedUnits: [
          {
            requestRef: "adult-2",
            unitId: "unit_adult",
            pricingCategoryId: "pc_adult",
            quantity: 2,
          },
          {
            requestRef: "child-1",
            unitId: "unit_child",
            pricingCategoryId: "pc_child",
            quantity: 1,
          },
        ],
      },
      offer: {
        clientId: "cont_client_1",
        notes: "Generated from sellability",
      },
      participants: [
        {
          firstName: "Ada",
          lastName: "Lovelace",
          participantType: "traveler",
          travelerCategory: "adult",
          requestedUnitRefs: ["adult-2"],
        },
        {
          firstName: "Grace",
          lastName: "Hopper",
          participantType: "traveler",
          travelerCategory: "child",
          assignToAllItems: true,
        },
      ],
      contactAssignments: [
        {
          firstName: "Mihai",
          lastName: "Booker",
          role: "primary_contact",
          isPrimary: true,
          email: "mihai@example.com",
        },
      ],
    })

    expect(result).not.toBeNull()
    expect(createOfferBundle).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledTimes(2)
    expect(values).toHaveBeenCalledTimes(2)
    expect(returning).toHaveBeenCalledTimes(1)
    expect(updateOfferMetadata).toHaveBeenCalledTimes(1)

    const payload = createOfferBundle.mock.calls[0]?.[1]
    expect(payload).toBeTruthy()
    if (!payload) {
      throw new Error("Expected createOfferBundle payload")
    }

    expect(payload.offer.title).toBe("City Escape · Private Tour · 2026-06-01")
    expect(payload.offer.offerNumber).toMatch(/^OFF-/)
    expect(payload.offer.marketId).toBe("market_1")
    expect(payload.offer.sourceChannelId).toBe("channel_1")
    expect(payload.offer.currency).toBe("EUR")
    expect(payload.offer.baseCurrency).toBe("USD")
    expect(payload.offer.fxRateSetId).toBe("fx_1")
    expect(payload.offer.totalAmountCents).toBe(21000)
    expect(payload.offer.costAmountCents).toBe(14500)
    expect(payload.offer.metadata?.sellability).toBeTruthy()

    expect(payload.items).toHaveLength(3)
    expect(payload.items[0]).toMatchObject({
      itemType: "unit",
      title: "Private Tour · Adult",
      unitId: "unit_adult",
      quantity: 2,
      totalSellAmountCents: 16000,
      totalCostAmountCents: 10000,
      startsAt: "2026-06-01T09:00:00.000Z",
    })
    expect(payload.items[1]).toMatchObject({
      itemType: "unit",
      title: "Private Tour · Child",
      unitId: "unit_child",
      quantity: 1,
      totalSellAmountCents: 3000,
    })
    expect(payload.items[2]).toMatchObject({
      itemType: "transport",
      title: "Pickup",
      quantity: 1,
      totalSellAmountCents: 2000,
    })

    expect(payload.itemTravelers).toEqual([
      { itemIndex: 0, participantIndex: 0, role: "traveler", isPrimary: false },
      { itemIndex: 0, participantIndex: 1, role: "traveler", isPrimary: false },
      { itemIndex: 1, participantIndex: 1, role: "traveler", isPrimary: false },
    ])
    expect(payload.contactAssignments).toEqual([
      {
        itemIndex: 0,
        role: "primary_contact",
        personId: null,
        firstName: "Mihai",
        lastName: "Booker",
        email: "mihai@example.com",
        phone: null,
        preferredLanguage: null,
        isPrimary: true,
        notes: null,
      },
    ])
    expect(result?.snapshot.id).toBe("sell_snap_1")
  })

  it("returns null when no sellable candidate matches the requested slot", async () => {
    const { db } = createMockDb()
    const createOfferBundle = vi.fn(
      async (_db: PostgresJsDatabase, _input: SellabilityOfferBundleInput) => null,
    )
    const service = createSellabilityService({
      offerWriter: {
        createOfferBundle,
        updateOfferMetadata: vi.fn(),
      } satisfies SellabilityOfferWriter,
    })

    vi.spyOn(service, "resolve").mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })

    const result = await service.constructOffer(db, {
      query: {
        slotId: "missing_slot",
        requestedUnits: [],
      },
      offer: {},
      participants: [],
    })

    expect(result).toBeNull()
    expect(createOfferBundle).not.toHaveBeenCalled()
  })
})
