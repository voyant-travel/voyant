import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { resolveOverlay } from "@voyantjs/catalog/overlay/resolver"
import { describe, expect, it } from "vitest"

import { extrasCatalogPolicy } from "../../src/catalog-policy.js"
import {
  productExtraProvenance,
  productExtraRowToProjection,
} from "../../src/service-catalog-plane.js"

const sampleRow = {
  id: "pext_abc",
  productId: "prod_parent",
  code: "TRANSFER_PRIVATE",
  name: "Private Airport Transfer",
  description: "Door-to-door private transfer.",
  selectionType: "optional" as const,
  pricingMode: "per_booking" as const,
  pricedPerPerson: false,
  minQuantity: null,
  maxQuantity: 1,
  defaultQuantity: 0,
  active: true,
  sortOrder: 0,
  metadata: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-04-01"),
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
} as any

describe("productExtraRowToProjection", () => {
  it("maps every column to its catalog-policy path", () => {
    const projection = productExtraRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("name")).toBe("Private Airport Transfer")
    expect(projection.get("productId")).toBe("prod_parent")
    expect(projection.get("selectionType")).toBe("optional")
    expect(projection.get("pricingMode")).toBe("per_booking")
  })

  it("inherits provenance from the parent product context", () => {
    const projection = productExtraRowToProjection(sampleRow, {
      sellerOperatorId: "op_xyz",
      sourceKind: "voyant-connect",
      sourceRef: "ext_external_999",
    })
    expect(projection.get("source.kind")).toBe("voyant-connect")
    expect(projection.get("source.ref")).toBe("ext_external_999")
  })

  it("projects thumbnailUrl from extra metadata when present", () => {
    const projection = productExtraRowToProjection(
      { ...sampleRow, metadata: { hero_image_url: "https://cdn.example/transfer.jpg" } },
      { sellerOperatorId: "op_xyz" },
    )
    expect(projection.get("thumbnailUrl")).toBe("https://cdn.example/transfer.jpg")
  })
})

describe("productExtraProvenance", () => {
  it("returns owned static-freshness when no parent source is given", () => {
    const p = productExtraProvenance(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(p.source_kind).toBe("owned")
    expect(p.source_freshness).toBe("static")
  })
})

describe("partial-adoption: resolver acts as visibility filter for snapshot fields", () => {
  it("the resolver returns the projected view with no overlay merges", () => {
    const projection = productExtraRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    const view = resolveOverlay(registry, projection, [], {
      locale: "en-GB",
      audience: "customer",
      market: "default",
      actor: "customer",
    })
    expect(view.values.get("name")).toBe("Private Airport Transfer")
    expect(view.provenance.get("name")).toBeNull() // no overlay applied
    // Snapshot-driving fields are present and customer-visible.
    expect(view.values.has("selectionType")).toBe(true)
    expect(view.values.has("pricingMode")).toBe(true)
  })

  it("staff-only sortOrder is hidden from customer audience", () => {
    const projection = productExtraRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    const view = resolveOverlay(registry, projection, [], {
      locale: "en-GB",
      audience: "customer",
      market: "default",
      actor: "customer",
    })
    expect(view.values.has("sortOrder")).toBe(false)
    expect(view.hidden.has("sortOrder")).toBe(true)
  })
})
