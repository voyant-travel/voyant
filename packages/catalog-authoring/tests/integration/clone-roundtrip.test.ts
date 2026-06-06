import { priceCatalogs } from "@voyantjs/pricing/schema"
import { createTestDb, describeIfDb } from "@voyantjs/voyant-test-utils/db"
import { beforeAll, expect, it } from "vitest"
import { buildProductGraph } from "../../src/builder.js"
import { serializeProductGraph } from "../../src/serialize.js"
import type { ProductGraphSpec } from "../../src/spec.js"

/**
 * Exercises the full clone machinery against a real DB: author a graph via the
 * builder, serialize it, then build the serialized spec again (= clone) and
 * confirm the clone is structurally identical with fresh ids and reuses the
 * source price catalog. Skips when TEST_DATABASE_URL is unset.
 */
describeIfDb("buildProductGraph + serializeProductGraph (clone round-trip)", () => {
  const db = createTestDb()
  let catalogId: string
  const stamp = `${Date.now()}`

  beforeAll(async () => {
    const [cat] = await db
      .insert(priceCatalogs)
      .values({ code: `CAT-${stamp}`, name: `Test ${stamp}`, currencyCode: "RON" })
      .returning({ id: priceCatalogs.id })
    catalogId = cat?.id as string
  })

  function multiDayTourSpec(): ProductGraphSpec {
    return {
      product: {
        name: `Pilgrimage ${stamp}`,
        status: "draft",
        bookingMode: "itinerary",
        capacityMode: "limited",
        visibility: "private",
        sellCurrency: "RON",
        termsShowOnContract: false,
        tags: ["pilgrimage"],
      } as ProductGraphSpec["product"],
      options: [
        {
          ref: "opt-standard",
          name: "Standard",
          status: "active",
          isDefault: true,
          sortOrder: 0,
          units: [
            {
              ref: "u-adult",
              name: "Adult",
              unitType: "person",
              isRequired: true,
              isHidden: false,
              sortOrder: 0,
            },
            {
              ref: "u-child",
              name: "Child",
              unitType: "person",
              minAge: 2,
              maxAge: 11,
              isRequired: false,
              isHidden: false,
              sortOrder: 1,
            },
          ],
          priceRules: [
            {
              priceCatalogId: catalogId,
              name: "Base",
              pricingMode: "per_person",
              allPricingCategories: true,
              isDefault: true,
              active: true,
              unitPriceRules: [
                {
                  unitRef: "u-adult",
                  pricingMode: "per_unit",
                  sellAmountCents: 52000,
                  active: true,
                  sortOrder: 0,
                  tiers: [
                    {
                      minQuantity: 1,
                      maxQuantity: 4,
                      sellAmountCents: 52000,
                      active: true,
                      sortOrder: 0,
                    },
                  ],
                },
                {
                  unitRef: "u-child",
                  pricingMode: "per_unit",
                  sellAmountCents: 36000,
                  active: true,
                  sortOrder: 1,
                  tiers: [],
                },
              ],
            },
          ],
        },
      ] as ProductGraphSpec["options"],
      paxPricingTiers: [
        { unitRef: "u-adult", tierPax: 2, pricePerPaxCents: 52000 },
        { unitRef: "u-adult", tierPax: 1, pricePerPaxCents: 68000 },
      ],
      itineraries: [
        {
          name: "Main itinerary",
          isDefault: true,
          sortOrder: 0,
          days: [
            {
              dayNumber: 1,
              title: "Arrival",
              services: [
                {
                  serviceType: "accommodation",
                  name: "Hotel night",
                  costCurrency: "RON",
                  costAmountCents: 18000,
                  quantity: 1,
                },
              ],
            },
            {
              dayNumber: 2,
              title: "Departure",
              services: [
                {
                  serviceType: "transfer",
                  name: "Airport transfer",
                  costCurrency: "RON",
                  costAmountCents: 8000,
                  quantity: 1,
                },
              ],
            },
          ],
        },
      ] as ProductGraphSpec["itineraries"],
    }
  }

  function countGraph(spec: ProductGraphSpec) {
    const units = spec.options.reduce((n, o) => n + o.units.length, 0)
    const rules = spec.options.reduce((n, o) => n + o.priceRules.length, 0)
    const unitRules = spec.options.reduce(
      (n, o) => n + o.priceRules.reduce((m, r) => m + r.unitPriceRules.length, 0),
      0,
    )
    const tiers = spec.options.reduce(
      (n, o) =>
        n +
        o.priceRules.reduce(
          (m, r) => m + r.unitPriceRules.reduce((k, ur) => k + ur.tiers.length, 0),
          0,
        ),
      0,
    )
    const days = spec.itineraries.reduce((n, i) => n + i.days.length, 0)
    const services = spec.itineraries.reduce(
      (n, i) => n + i.days.reduce((m, d) => m + d.services.length, 0),
      0,
    )
    return {
      options: spec.options.length,
      units,
      rules,
      unitRules,
      tiers,
      pax: spec.paxPricingTiers.length,
      itineraries: spec.itineraries.length,
      days,
      services,
    }
  }

  it("clones a graph: identical structure, fresh ids, reused catalog", async () => {
    const source = await db.transaction((tx) =>
      buildProductGraph(tx, multiDayTourSpec(), {
        userId: "test-user",
        defaultCatalogId: catalogId,
      }),
    )

    const serialized = await serializeProductGraph(db, source.productId)
    expect(serialized).not.toBeNull()
    if (!serialized) return

    // Clone: patch the name, rebuild. No defaultCatalogId — rules carry the
    // source catalog, proving catalog reuse.
    const cloneSpec: ProductGraphSpec = {
      ...serialized,
      product: { ...serialized.product, name: `Clone ${stamp}` },
    }
    const clone = await db.transaction((tx) =>
      buildProductGraph(tx, cloneSpec, { userId: "test-user" }),
    )

    expect(clone.productId).not.toBe(source.productId)

    const cloneSerialized = await serializeProductGraph(db, clone.productId)
    expect(cloneSerialized).not.toBeNull()
    if (!cloneSerialized) return

    expect(countGraph(cloneSerialized)).toEqual(countGraph(serialized))
    expect(cloneSerialized.product.name).toBe(`Clone ${stamp}`)
    expect(cloneSerialized.product.bookingMode).toBe("itinerary")

    // Catalog reuse: every cloned rule points at the source catalog.
    for (const opt of cloneSerialized.options) {
      for (const rule of opt.priceRules) {
        expect(rule.priceCatalogId).toBe(catalogId)
      }
    }
  })
})
