import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { resolveOverlay } from "@voyantjs/catalog/overlay/resolver"
import { describe, expect, it } from "vitest"

import { accommodationCatalogPolicy } from "../../src/catalog-policy.js"
import { roomTypeProvenance, roomTypeRowToProjection } from "../../src/service-catalog-plane.js"

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
