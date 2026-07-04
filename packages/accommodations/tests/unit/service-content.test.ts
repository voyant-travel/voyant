import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  facilities,
  facilityAddressProjections,
  facilityFeatures,
  properties,
} from "@voyant-travel/operations"
import { describe, expect, it } from "vitest"

import {
  mealPlans,
  ratePlanDailyRates,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeBedConfigs,
  roomTypeDailyInventory,
  roomTypes,
} from "../../src/schema-inventory.js"
import { buildOwnedAccommodationContent } from "../../src/service-content.js"

class FakeSelectQuery {
  constructor(private readonly rows: unknown[]) {}

  from() {
    return this
  }

  where() {
    return this
  }

  limit() {
    return Promise.resolve(this.rows)
  }

  orderBy() {
    return Promise.resolve(this.rows)
  }
}

function fakeDb(rowsByTable: Map<unknown, unknown[]>): AnyDrizzleDb {
  return {
    select() {
      return {
        from(table: unknown) {
          return new FakeSelectQuery(rowsByTable.get(table) ?? [])
        },
      }
    },
  } as AnyDrizzleDb
}

describe("buildOwnedAccommodationContent", () => {
  it("projects owned room types into renderable accommodation content", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [
          roomTypes,
          [
            {
              id: "rmtp_family",
              propertyId: "prop_mitsis",
              code: "FAMILY",
              name: "Family Garden View",
              description: "Garden-facing family room.",
              inventoryMode: "pooled",
              supplierId: null,
              roomClass: "family",
              maxAdults: 2,
              maxChildren: 2,
              maxInfants: 1,
              standardOccupancy: 4,
              maxOccupancy: 5,
              minOccupancy: 1,
              bedroomCount: 1,
              bathroomCount: 1,
              areaValue: 32,
              areaUnit: "sqm",
              accessibilityNotes: null,
              smokingAllowed: false,
              active: true,
              sortOrder: 1,
              metadata: {
                view: "garden",
                amenities: ["Wi-Fi"],
                images: ["https://cdn.example/family.jpg"],
              },
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          properties,
          [
            {
              id: "prop_mitsis",
              facilityId: "fac_mitsis",
              propertyType: "hotel",
              brandName: "Mitsis",
              groupName: null,
              rating: 4,
              ratingScale: 5,
              checkInTime: "14:00",
              checkOutTime: "11:00",
              policyNotes: "Photo ID required.",
              amenityNotes: null,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          facilities,
          [
            {
              id: "fac_mitsis",
              parentFacilityId: null,
              ownerType: "supplier",
              ownerId: "sup_mitsis",
              kind: "hotel",
              status: "active",
              name: "Mitsis Rinela",
              code: "MIT-RIN",
              description: "Beachfront resort.",
              timezone: "Europe/Athens",
              tags: [],
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          facilityAddressProjections,
          [
            {
              facilityId: "fac_mitsis",
              addressId: "addr_1",
              fullText: "Kokkini Hani, Crete",
              line1: "Kokkini Hani",
              line2: null,
              city: "Heraklion",
              region: "Crete",
              postalCode: "71500",
              country: "GR",
              latitude: 35.33,
              longitude: 25.25,
              address: "Kokkini Hani, Crete",
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          facilityFeatures,
          [
            {
              id: "feat_wifi",
              facilityId: "fac_mitsis",
              category: "amenity",
              code: "wifi",
              name: "Wi-Fi",
              description: "Included property Wi-Fi.",
              valueText: null,
              highlighted: true,
              sortOrder: 1,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          roomTypeBedConfigs,
          [
            {
              id: "bed_1",
              roomTypeId: "rmtp_family",
              bedType: "queen",
              quantity: 2,
              isPrimary: true,
              notes: null,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          mealPlans,
          [
            {
              id: "meal_bb",
              propertyId: "prop_mitsis",
              code: "BB",
              name: "Breakfast",
              description: null,
              includesBreakfast: true,
              includesLunch: false,
              includesDinner: false,
              includesDrinks: false,
              active: true,
              sortOrder: 1,
              metadata: null,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
            {
              id: "meal_ai",
              propertyId: "prop_mitsis",
              code: "AI",
              name: "All Inclusive",
              description: null,
              includesBreakfast: true,
              includesLunch: true,
              includesDinner: true,
              includesDrinks: true,
              active: true,
              sortOrder: 2,
              metadata: null,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          ratePlans,
          [
            {
              id: "rate_flex",
              propertyId: "prop_mitsis",
              code: "FLEX",
              name: "Flexible",
              description: "Flexible cancellation.",
              mealPlanId: "meal_bb",
              priceCatalogId: null,
              cancellationPolicyId: "policy_flex",
              marketId: null,
              currencyCode: "EUR",
              chargeFrequency: "per_night",
              guaranteeMode: "none",
              commissionable: true,
              refundable: true,
              active: true,
              sortOrder: 1,
              customerPaymentPolicy: null,
              metadata: null,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          ratePlanRoomTypes,
          [
            {
              id: "rprt_1",
              ratePlanId: "rate_flex",
              roomTypeId: "rmtp_family",
              productId: null,
              optionId: null,
              unitId: null,
              active: true,
              sortOrder: 1,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          ratePlanDailyRates,
          [
            {
              id: "rate_day_1",
              ratePlanId: "rate_flex",
              roomTypeId: "rmtp_family",
              date: "2099-07-12",
              sellCurrency: "EUR",
              sellAmountCents: 24000,
              costCurrency: null,
              costAmountCents: null,
              taxAmountCents: null,
              feeAmountCents: null,
              occupancyBasis: "room",
              includedAdults: 2,
              includedChildren: 0,
              includedInfants: 0,
              metadata: null,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          roomTypeDailyInventory,
          [
            {
              id: "inv_1",
              roomTypeId: "rmtp_family",
              date: "2099-07-12",
              capacity: 2,
              closed: false,
              metadata: null,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
            },
          ],
        ],
      ]),
    )

    const result = await buildOwnedAccommodationContent(db, "rmtp_family", {
      preferredLocales: ["en-GB"],
    })

    expect(result).not.toBeNull()
    expect(result?.content.hotel.name).toBe("Mitsis Rinela")
    expect(result?.content.hotel.city).toBe("Heraklion")
    expect(result?.content.room_types).toHaveLength(1)
    expect(result?.content.room_types[0]).toMatchObject({
      id: "rmtp_family",
      name: "Family Garden View",
      images: ["https://cdn.example/family.jpg"],
      beds: ["2 queen"],
    })
    expect(result?.content.rate_plans[0]).toMatchObject({
      id: "rate_flex",
      applies_to_room_type_ids: ["rmtp_family"],
    })
    expect(result?.content.meal_plans[0]).toMatchObject({
      id: "meal_bb",
      basis: "bed_breakfast",
    })
    expect(result?.content.meal_plans[1]).toMatchObject({
      id: "meal_ai",
      basis: "all_inclusive",
      inclusions: ["Breakfast", "Lunch", "Dinner", "Drinks"],
    })
    expect(result?.content.amenities[0]).toMatchObject({ id: "wifi", name: "Wi-Fi" })
  })

  it("does not serve owned accommodation detail content for inactive rooms", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [
          roomTypes,
          [
            {
              id: "rmtp_inactive",
              propertyId: "prop_mitsis",
              name: "Inactive Room",
              active: false,
            },
          ],
        ],
      ]),
    )

    await expect(
      buildOwnedAccommodationContent(db, "rmtp_inactive", { preferredLocales: ["en-GB"] }),
    ).resolves.toBeNull()
  })
})
