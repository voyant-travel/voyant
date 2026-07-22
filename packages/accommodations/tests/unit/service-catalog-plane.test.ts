import { createReferencedSubjectDocumentBuilderContext } from "@voyant-travel/catalog/catalog-runtime"
import { createFieldPolicyRegistry } from "@voyant-travel/catalog/contract"
import { resolveOverlay } from "@voyant-travel/catalog/overlay/resolver"
import {
  facilities,
  facilityAddressProjections,
  facilityFeatures,
  properties,
} from "@voyant-travel/operations"
import { describe, expect, it } from "vitest"

import { accommodationCatalogPolicy } from "../../src/catalog-policy.js"
import { accommodationPropertyCatalogPolicy } from "../../src/catalog-policy-properties.js"
import {
  ratePlanDailyRates,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeDailyInventory,
  roomTypes,
} from "../../src/schema-inventory.js"
import {
  createRoomTypeDocumentBuilder,
  roomTypeProvenance,
  roomTypeRowToProjection,
} from "../../src/service-catalog-plane.js"

const sampleRow = {
  id: "rmtp_abc",
  propertyId: "prop_mitsis",
  code: "FAMILY_GARDEN_VIEW",
  name: "Family Garden View",
  description: "Spacious family room overlooking the gardens.",
  inventoryMode: "pooled" as const,
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
  accessibilityNotes: "Step-free access via main lobby",
  smokingAllowed: false,
  active: true,
  sortOrder: 10,
  metadata: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-04-01"),
  // biome-ignore lint/suspicious/noExplicitAny: test fixture -- owner: accommodations; existing suppression is intentional pending typed cleanup.
} as any

describe("roomTypeRowToProjection", () => {
  it("maps every column to its catalog-policy path", () => {
    const projection = roomTypeRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("name")).toBe("Family Garden View")
    expect(projection.get("propertyId")).toBe("prop_mitsis")
    expect(projection.get("maxOccupancy")).toBe(5)
    expect(projection.get("smokingAllowed")).toBe(false)
  })

  it("synthesizes direct-supplier provenance by default", () => {
    const projection = roomTypeRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("source.kind")).toBe("direct")
  })

  it("accepts sourced provenance for bedbank integrations", () => {
    const projection = roomTypeRowToProjection(sampleRow, {
      sellerOperatorId: "op_xyz",
      sourceKind: "bedbank:hotelbeds",
      sourceRef: "rmtp_external_12345",
    })
    expect(projection.get("source.kind")).toBe("bedbank:hotelbeds")
    expect(projection.get("source.ref")).toBe("rmtp_external_12345")
  })

  it("projects thumbnailUrl from room metadata when present", () => {
    const projection = roomTypeRowToProjection(
      { ...sampleRow, metadata: { images: ["https://cdn.example/family-room.jpg"] } },
      { sellerOperatorId: "op_xyz" },
    )
    expect(projection.get("thumbnailUrl")).toBe("https://cdn.example/family-room.jpg")
  })
})

describe("roomTypeProvenance", () => {
  it("returns sync-freshness for bedbank-sourced rooms", () => {
    const p = roomTypeProvenance(sampleRow, {
      sellerOperatorId: "op_xyz",
      sourceKind: "bedbank:hotelbeds",
      sourceRef: "x",
    })
    expect(p.source_kind).toBe("bedbank:hotelbeds")
    expect(p.source_freshness).toBe("sync")
  })
})

describe("end-to-end: projection + resolver", () => {
  it("staff actor sees accessibility notes; customer sees them too (visibility includes both)", () => {
    const projection = roomTypeRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)

    const customerView = resolveOverlay(registry, projection, [], {
      locale: "en-GB",
      audience: "customer",
      market: "default",
      actor: "customer",
    })
    expect(customerView.values.has("accessibilityNotes")).toBe(true)
    expect(customerView.values.has("name")).toBe(true)
    expect(customerView.values.has("description")).toBe(true)
  })

  it("applies marketing overlay on description for customer audience", () => {
    const projection = roomTypeRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
    const view = resolveOverlay(
      registry,
      projection,
      [
        {
          field_path: "description",
          locale: "en-GB",
          audience: "customer",
          market: "default",
          value: "Refreshed marketing copy: serene garden views and family comfort.",
        },
      ],
      { locale: "en-GB", audience: "customer", market: "default", actor: "customer" },
    )
    expect(view.values.get("description")).toBe(
      "Refreshed marketing copy: serene garden views and family comfort.",
    )
  })
})

describe("createRoomTypeDocumentBuilder", () => {
  const customerSlice = {
    vertical: "accommodations",
    locale: "en-GB",
    audience: "customer",
    market: "default",
  } as const
  const staffSlice = { ...customerSlice, audience: "staff" } as const

  it("keeps inactive rooms out of customer slices while preserving staff docs", async () => {
    const inactiveRow = { ...sampleRow, active: false }
    const builder = createRoomTypeDocumentBuilder(fakeDb(new Map([[roomTypes, [inactiveRow]]])), {
      sellerOperatorId: "op_xyz",
    })

    await expect(builder("rmtp_abc", customerSlice)).resolves.toBeNull()
    await expect(builder("rmtp_abc", staffSlice)).resolves.not.toBeNull()
  })

  it("requires active rates, future prices, and open inventory for customer docs", async () => {
    const builderWithInventoryOnDifferentDate = createRoomTypeDocumentBuilder(
      fakeDb(
        new Map<unknown, unknown[]>([
          [roomTypes, [sampleRow]],
          [
            ratePlanRoomTypes,
            [{ id: "map_1", ratePlanId: "rate_1", roomTypeId: sampleRow.id, active: true }],
          ],
          [ratePlans, [{ id: "rate_1", active: true }]],
          [
            ratePlanDailyRates,
            [
              {
                id: "rate_day_1",
                ratePlanId: "rate_1",
                roomTypeId: sampleRow.id,
                date: "2099-01-15",
                sellAmountCents: 12000,
              },
            ],
          ],
          [
            roomTypeDailyInventory,
            [
              {
                id: "inv_1",
                roomTypeId: sampleRow.id,
                date: "2099-01-16",
                capacity: 3,
                closed: false,
              },
            ],
          ],
        ]),
      ),
      { sellerOperatorId: "op_xyz" },
    )
    await expect(builderWithInventoryOnDifferentDate("rmtp_abc", customerSlice)).resolves.toBeNull()

    const builderWithoutInventory = createRoomTypeDocumentBuilder(
      fakeDb(
        new Map<unknown, unknown[]>([
          [roomTypes, [sampleRow]],
          [
            ratePlanRoomTypes,
            [{ id: "map_1", ratePlanId: "rate_1", roomTypeId: sampleRow.id, active: true }],
          ],
          [ratePlans, [{ id: "rate_1", active: true }]],
          [
            ratePlanDailyRates,
            [
              {
                id: "rate_day_1",
                ratePlanId: "rate_1",
                roomTypeId: sampleRow.id,
                date: "2099-01-15",
                sellAmountCents: 12000,
              },
            ],
          ],
          [
            roomTypeDailyInventory,
            [
              {
                id: "inv_1",
                roomTypeId: sampleRow.id,
                date: "2099-01-15",
                capacity: 0,
                closed: false,
              },
            ],
          ],
        ]),
      ),
      { sellerOperatorId: "op_xyz" },
    )
    await expect(builderWithoutInventory("rmtp_abc", customerSlice)).resolves.toBeNull()

    const builderWithInventory = createRoomTypeDocumentBuilder(
      fakeDb(
        new Map<unknown, unknown[]>([
          [roomTypes, [sampleRow]],
          [
            ratePlanRoomTypes,
            [{ id: "map_1", ratePlanId: "rate_1", roomTypeId: sampleRow.id, active: true }],
          ],
          [ratePlans, [{ id: "rate_1", active: true }]],
          [
            ratePlanDailyRates,
            [
              {
                id: "rate_day_1",
                ratePlanId: "rate_1",
                roomTypeId: sampleRow.id,
                date: "2099-01-15",
                sellAmountCents: 12000,
              },
            ],
          ],
          [
            roomTypeDailyInventory,
            [
              {
                id: "inv_1",
                roomTypeId: sampleRow.id,
                date: "2099-01-15",
                capacity: 3,
                closed: false,
              },
            ],
          ],
        ]),
      ),
      { sellerOperatorId: "op_xyz" },
    )

    await expect(builderWithInventory("rmtp_abc", customerSlice)).resolves.not.toBeNull()
  })

  it("falls back from the real sourced-subject context to an effective owned property", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [roomTypes, [sampleRow]],
        [
          properties,
          [
            {
              id: "prop_mitsis",
              facilityId: "fac_mitsis",
              brandName: "Mitsis",
              groupName: null,
              rating: 5,
              checkInTime: "14:00",
              checkOutTime: "11:00",
            },
          ],
        ],
        [
          facilities,
          [
            {
              id: "fac_mitsis",
              name: "Effective Property Name",
              description: "Effective property description",
            },
          ],
        ],
        [facilityAddressProjections, []],
        [facilityFeatures, []],
      ]),
    )
    const builder = createRoomTypeDocumentBuilder(db, { sellerOperatorId: "op_xyz" })
    const runtimeContext = createReferencedSubjectDocumentBuilderContext(
      db,
      staffSlice,
      new Map([
        ["accommodation-properties", createFieldPolicyRegistry(accommodationPropertyCatalogPolicy)],
      ]),
    )

    const document = await builder("rmtp_abc", staffSlice, runtimeContext)

    expect(document?.fields.name).toBe("Family Garden View")
    expect(document?.fields["property.name"]).toBe("Effective Property Name")
    expect(document?.fields["property.description"]).toBe("Effective property description")
  })
})

function fakeDb(rowsByTable: Map<unknown, unknown[]>) {
  return {
    select: () => ({
      from: (table: unknown) => selectable(rowsByTable.get(table) ?? []),
    }),
  } as never
}

function selectable(rows: unknown[]) {
  return {
    where: () => promiseChain(rows),
    orderBy: async () => rows,
    limit: async (limit: number) => rows.slice(0, limit),
  }
}

type QueryPromise = Promise<unknown[]> & {
  limit: (limit: number) => Promise<unknown[]>
}

function promiseChain(rows: unknown[]): QueryPromise {
  const promise = Promise.resolve(rows) as QueryPromise
  promise.limit = async (limit: number) => rows.slice(0, limit)
  return promise
}
