import { pricingCategories } from "@voyant-travel/commerce"
import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { describe, expect, it } from "vitest"

import { loadProductTravelerCategories } from "../../src/booking-engine/product-runtime.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

describe.skipIf(!TEST_DATABASE_URL)("product booking runtime global pricing categories", () => {
  const db = createTestDb()

  it("loads an active global Adult category referenced by a resolved room price", async () => {
    await cleanupTestDb(db)
    const [adult] = await db
      .insert(pricingCategories)
      .values({
        code: "ADULT",
        name: "Adult",
        categoryType: "adult",
        active: true,
      })
      .returning({ id: pricingCategories.id })

    const rows = await loadProductTravelerCategories(db, "prod_turkey", [adult!.id])

    expect(rows).toEqual([
      expect.objectContaining({
        id: adult!.id,
        name: "Adult",
        categoryType: "adult",
      }),
    ])
  })
})
