import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { resolveOverlay } from "@voyantjs/catalog/overlay/resolver"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"

import { productCatalogPolicy } from "../../src/catalog-policy.js"
import {
  createProductStorefrontCardProjectionExtension,
  productProvenance,
  productRowToProjection,
} from "../../src/service-catalog-plane.js"

const sampleRow = {
  id: "prod_abc",
  name: "Bali Wellness Retreat",
  status: "active" as const,
  description: "Source description",
  bookingMode: "date" as const,
  capacityMode: "limited" as const,
  timezone: "Asia/Jakarta",
  visibility: "public" as const,
  activated: true,
  reservationTimeoutMinutes: 30,
  sellCurrency: "EUR",
  sellAmountCents: 250000,
  costAmountCents: 180000,
  marginPercent: 28,
  facilityId: null,
  startDate: "2026-05-01",
  endDate: "2026-12-31",
  pax: 12,
  productTypeId: "ptyp_wellness",
  tags: ["wellness", "yoga"],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-04-01"),
  // biome-ignore lint/suspicious/noExplicitAny: test fixture; product row may have additional cols
} as any

const customerSlice = {
  vertical: "products",
  locale: "ro-RO",
  audience: "customer",
  market: "default",
} as const

function projectionDb(selectResponses: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>) {
  let selectIndex = 0
  const db = {
    select: () => {
      const rows = selectResponses[selectIndex++] ?? []
      return {
        from: () => ({
          where: () => ({
            orderBy: async () => rows,
          }),
        }),
      }
    },
    execute: async () => [{ count: 0 }],
  }
  return db as unknown as AnyDrizzleDb
}

describe("productRowToProjection", () => {
  it("maps every column to its catalog-policy path", () => {
    const projection = productRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("name")).toBe("Bali Wellness Retreat")
    expect(projection.get("status")).toBe("active")
    expect(projection.get("sellCurrency")).toBe("EUR")
    expect(projection.get("sellAmountCents")).toBe(250000)
    expect(projection.get("tags[]")).toEqual(["wellness", "yoga"])
    expect(projection.get("productTypeId")).toBe("ptyp_wellness")
  })

  it("synthesizes provenance fields for owned products", () => {
    const projection = productRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("source.kind")).toBe("owned")
    expect(projection.get("seller.operator_id")).toBe("op_xyz")
  })

  it("includes internal-only fields in the projection (visibility filter happens later)", () => {
    const projection = productRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("costAmountCents")).toBe(180000)
    expect(projection.get("marginPercent")).toBe(28)
  })
})

describe("productProvenance", () => {
  it("returns owned provenance with static freshness", () => {
    const provenance = productProvenance(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(provenance.source_kind).toBe("owned")
    expect(provenance.source_freshness).toBe("static")
    expect(provenance.source_ref).toBeUndefined()
  })
})

describe("end-to-end: projection + resolver visibility filter", () => {
  it("staff actor sees internal-only fields; customer actor does not", () => {
    const projection = productRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(productCatalogPolicy)

    const staffView = resolveOverlay(registry, projection, [], {
      locale: "en-GB",
      audience: "staff",
      market: "default",
      actor: "staff",
    })
    expect(staffView.values.has("costAmountCents")).toBe(true)
    expect(staffView.values.has("marginPercent")).toBe(true)

    const customerView = resolveOverlay(registry, projection, [], {
      locale: "en-GB",
      audience: "customer",
      market: "default",
      actor: "customer",
    })
    expect(customerView.values.has("costAmountCents")).toBe(false)
    expect(customerView.values.has("marginPercent")).toBe(false)
    expect(customerView.hidden.has("costAmountCents")).toBe(true)
    expect(customerView.values.has("name")).toBe(true)
    expect(customerView.values.has("description")).toBe(true)
  })

  it("applies a marketing overlay on title for the customer audience", () => {
    const projection = productRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(productCatalogPolicy)

    const view = resolveOverlay(
      registry,
      projection,
      [
        {
          field_path: "name",
          locale: "en-GB",
          audience: "customer",
          market: "default",
          value: "✨ Sunset Wellness Escape",
        },
      ],
      {
        locale: "en-GB",
        audience: "customer",
        market: "default",
        actor: "customer",
      },
    )
    expect(view.values.get("name")).toBe("✨ Sunset Wellness Escape")
    expect(view.provenance.get("name")).toEqual({
      locale: "en-GB",
      audience: "customer",
      market: "default",
    })
  })
})

describe("createProductStorefrontCardProjectionExtension", () => {
  it("preserves base rich text fields when a translation is absent", async () => {
    const extension = createProductStorefrontCardProjectionExtension()
    const projection = await extension.project(
      projectionDb([[], [], [], []]),
      "prod_abc",
      customerSlice,
    )

    expect(projection.has("inclusionsHtml")).toBe(false)
    expect(projection.has("exclusionsHtml")).toBe(false)
    expect(projection.has("termsHtml")).toBe(false)
  })

  it("preserves base rich text fields when the selected translation is partial", async () => {
    const extension = createProductStorefrontCardProjectionExtension()
    const projection = await extension.project(
      projectionDb([
        [
          {
            languageTag: "ro",
            name: "Retreat Bali",
            slug: "retreat-bali",
            shortDescription: "Descriere scurta",
            inclusionsHtml: null,
            exclusionsHtml: null,
            termsHtml: null,
          },
        ],
        [],
        [],
        [],
      ]),
      "prod_abc",
      customerSlice,
    )

    expect(projection.get("name")).toBe("Retreat Bali")
    expect(projection.has("inclusionsHtml")).toBe(false)
    expect(projection.has("exclusionsHtml")).toBe(false)
    expect(projection.has("termsHtml")).toBe(false)
  })
})
