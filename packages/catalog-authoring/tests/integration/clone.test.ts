import { priceCatalogs } from "@voyantjs/commerce"
import { createTestDb, describeIfDb } from "@voyantjs/voyant-test-utils/db"
import { beforeAll, expect, it } from "vitest"
import { buildProductGraph } from "../../src/builder.js"
import { cloneProduct } from "../../src/clone.js"
import type { ProductGraphSpec } from "../../src/spec.js"

describeIfDb("cloneProduct", () => {
  const db = createTestDb()
  const stamp = `${Date.now()}`
  let catalogId: string
  let sourceId: string

  beforeAll(async () => {
    const [cat] = await db
      .insert(priceCatalogs)
      .values({ code: `CAT-${stamp}`, name: `Test ${stamp}`, currencyCode: "RON" })
      .returning({ id: priceCatalogs.id })
    catalogId = cat?.id as string

    const spec: ProductGraphSpec = {
      product: {
        name: `Source ${stamp}`,
        status: "active",
        bookingMode: "itinerary",
        capacityMode: "limited",
        visibility: "private",
        sellCurrency: "RON",
        termsShowOnContract: false,
        tags: [],
      } as ProductGraphSpec["product"],
      options: [
        {
          ref: "o",
          name: "Standard",
          status: "active",
          isDefault: true,
          sortOrder: 0,
          units: [
            {
              ref: "a",
              name: "Adult",
              unitType: "person",
              isRequired: true,
              isHidden: false,
              sortOrder: 0,
            },
            {
              ref: "c",
              name: "Child",
              unitType: "person",
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
                  unitRef: "a",
                  pricingMode: "per_unit",
                  sellAmountCents: 50000,
                  active: true,
                  sortOrder: 0,
                  tiers: [],
                },
              ],
            },
          ],
        },
      ] as ProductGraphSpec["options"],
      paxPricingTiers: [],
      itineraries: [
        {
          name: "Main",
          isDefault: true,
          sortOrder: 0,
          days: [1, 2].map((n) => ({
            dayNumber: n,
            title: `Day ${n}`,
            description: null,
            location: null,
            services: [],
          })),
        },
      ] as ProductGraphSpec["itineraries"],
    }
    const built = await db.transaction((tx) =>
      buildProductGraph(tx, spec, { userId: "test-user", defaultCatalogId: catalogId }),
    )
    sourceId = built.productId
  })

  it("clones into a fresh draft with new ids and returns cloned option/unit ids", async () => {
    const outcome = await cloneProduct(db, sourceId, {
      name: `Clone ${stamp}`,
      copyDepartures: false,
      userId: "test-user",
    })
    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.product.id).not.toBe(sourceId)
    expect(outcome.product.name).toBe(`Clone ${stamp}`)
    expect(outcome.product.status).toBe("draft")
    expect(outcome.product.activated).toBe(false)
    expect(outcome.options).toHaveLength(1)
    expect(outcome.options[0]?.units).toHaveLength(2)
    expect(outcome.reused).toBe(false)
  })

  it("defaults the name to '{source} (Copy)' when no override is given", async () => {
    const outcome = await cloneProduct(db, sourceId, { copyDepartures: false })
    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.product.name).toBe(`Source ${stamp} (Copy)`)
  })

  it("is idempotent under a repeated Idempotency-Key", async () => {
    const key = `clone-idem-${stamp}`
    const first = await cloneProduct(db, sourceId, { name: `Once ${stamp}`, idempotencyKey: key })
    const second = await cloneProduct(db, sourceId, { name: `Once ${stamp}`, idempotencyKey: key })
    expect(first.status).toBe("ok")
    expect(second.status).toBe("ok")
    if (first.status !== "ok" || second.status !== "ok") return
    expect(second.reused).toBe(true)
    expect(second.product.id).toBe(first.product.id)
  })

  it("returns not_found for an unknown source", async () => {
    const outcome = await cloneProduct(db, "prod_does_not_exist", { name: "x" })
    expect(outcome.status).toBe("not_found")
  })
})
