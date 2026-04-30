import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { resolveOverlay } from "@voyantjs/catalog/overlay/resolver"
import { describe, expect, it } from "vitest"

import { charterCatalogPolicy } from "../../src/catalog-policy.js"
import {
  charterProductRowToProjection,
  charterProvenance,
} from "../../src/service-catalog-plane.js"

const sampleRow = {
  id: "chrt_abc",
  slug: "aman-experience-week",
  name: "Aman Experience Week",
  lineSupplierId: "supp_aman",
  defaultYachtId: "chry_aman_alegra",
  description: "Source description",
  shortDescription: "Short blurb",
  heroImageUrl: "https://example.com/hero.jpg",
  mapImageUrl: "https://example.com/map.jpg",
  regions: ["Mediterranean"],
  themes: ["luxury", "all-inclusive"],
  status: "draft" as const,
  defaultBookingModes: ["whole_yacht" as const, "per_suite" as const],
  defaultMybaTemplateId: "ctpl_myba_2026",
  defaultApaPercent: "27.50",
  lowestPriceCachedAmount: "85000.00",
  lowestPriceCachedCurrency: "EUR",
  earliestVoyageCached: "2026-05-01",
  latestVoyageCached: "2026-09-30",
  externalRefs: {},
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-04-01"),
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
} as any

describe("charterProductRowToProjection", () => {
  it("maps every column to its catalog-policy path", () => {
    const projection = charterProductRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("name")).toBe("Aman Experience Week")
    expect(projection.get("defaultBookingModes")).toEqual(["whole_yacht", "per_suite"])
    expect(projection.get("defaultApaPercent")).toBe("27.50")
    expect(projection.get("defaultMybaTemplateId")).toBe("ctpl_myba_2026")
  })
})

describe("charterProvenance", () => {
  it("returns owned static-freshness for owned charters", () => {
    const p = charterProvenance(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(p.source_kind).toBe("owned")
    expect(p.source_freshness).toBe("static")
  })
})

describe("end-to-end: projection + resolver visibility for charter-specific fields", () => {
  it("APA percent and MYBA template are visible to staff/customer/partner per policy", () => {
    const projection = charterProductRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)

    const customerView = resolveOverlay(registry, projection, [], {
      locale: "en-GB",
      audience: "customer",
      market: "default",
      actor: "customer",
    })
    // APA% is customer-visible (it's part of the booking quote disclosure).
    expect(customerView.values.has("defaultApaPercent")).toBe(true)
    // MYBA template id is staff-only.
    expect(customerView.values.has("defaultMybaTemplateId")).toBe(false)

    const staffView = resolveOverlay(registry, projection, [], {
      locale: "en-GB",
      audience: "staff",
      market: "default",
      actor: "staff",
    })
    expect(staffView.values.has("defaultMybaTemplateId")).toBe(true)
  })

  it("applies marketing overlay on charter name + description for customer", () => {
    const projection = charterProductRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(charterCatalogPolicy)
    const view = resolveOverlay(
      registry,
      projection,
      [
        {
          field_path: "name",
          locale: "en-GB",
          audience: "customer",
          market: "default",
          value: "✨ The Aman Yacht Experience",
        },
      ],
      { locale: "en-GB", audience: "customer", market: "default", actor: "customer" },
    )
    expect(view.values.get("name")).toBe("✨ The Aman Yacht Experience")
  })
})
