import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"
import { priceCatalogs } from "./schema-catalogs.js"
import { optionPriceRules } from "./schema-option-rules.js"
import {
  createOptionPriceRule,
  listOptionPriceRules,
  updateOptionPriceRule,
} from "./service-option-rules.js"
import { insertOptionPriceRuleSchema } from "./validation.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL
const db = DB_AVAILABLE ? createTestDb() : (null as never)

/** Build a fully-defaulted create input from a minimal fixture. */
function ruleInput(partial: {
  productId: string
  optionId: string
  priceCatalogId: string
  name: string
  isDefault?: boolean
  active?: boolean
}) {
  return insertOptionPriceRuleSchema.parse({ pricingMode: "per_person", ...partial })
}

async function seedCatalog(code: string) {
  const [catalog] = await db
    .insert(priceCatalogs)
    .values({
      code,
      name: code,
      currencyCode: "EUR",
      catalogType: "public",
      isDefault: true,
      active: true,
    })
    .returning()
  if (!catalog) throw new Error("failed to seed price catalog")
  return catalog
}

function countDefaults(optionId: string, priceCatalogId: string) {
  return db
    .select()
    .from(optionPriceRules)
    .where(
      and(
        eq(optionPriceRules.optionId, optionId),
        eq(optionPriceRules.priceCatalogId, priceCatalogId),
        eq(optionPriceRules.isDefault, true),
        eq(optionPriceRules.active, true),
      ),
    )
}

// Regression for #1601 gap #2: a save path that inserts the default rate plan
// could fan out several active `is_default` rows, only the newest of which was
// priced — and the public departures reader then surfaced an empty duplicate.
describe.skipIf(!DB_AVAILABLE)("option price rule single-default enforcement", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("demotes a prior default when a second default plan is created", async () => {
    const catalog = await seedCatalog("PUB-EUR-1")
    const productId = "prod_default_1"
    const optionId = "opt_default_1"

    const first = await createOptionPriceRule(
      db,
      ruleInput({
        productId,
        optionId,
        priceCatalogId: catalog.id,
        name: "First default",
        isDefault: true,
        active: true,
      }),
    )
    const second = await createOptionPriceRule(
      db,
      ruleInput({
        productId,
        optionId,
        priceCatalogId: catalog.id,
        name: "Second default",
        isDefault: true,
        active: true,
      }),
    )

    const defaults = await countDefaults(optionId, catalog.id)
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.id).toBe(second?.id)

    // The earlier plan still exists, just no longer the default.
    const all = await listOptionPriceRules(db, { optionId, limit: 50, offset: 0 })
    expect(all.data).toHaveLength(2)
    const demoted = all.data.find((rule) => rule.id === first?.id)
    expect(demoted?.isDefault).toBe(false)
  })

  it("does not touch defaults in a different option or catalog", async () => {
    const catalog = await seedCatalog("PUB-EUR-2")
    const otherCatalog = await seedCatalog("PUB-EUR-3")

    const keep = await createOptionPriceRule(
      db,
      ruleInput({
        productId: "prod_a",
        optionId: "opt_a",
        priceCatalogId: catalog.id,
        name: "Option A default",
        isDefault: true,
        active: true,
      }),
    )
    // Different option, same catalog — must stay default.
    const otherOption = await createOptionPriceRule(
      db,
      ruleInput({
        productId: "prod_b",
        optionId: "opt_b",
        priceCatalogId: catalog.id,
        name: "Option B default",
        isDefault: true,
        active: true,
      }),
    )
    // Same option, different catalog — must stay default.
    const otherCatalogRule = await createOptionPriceRule(
      db,
      ruleInput({
        productId: "prod_a",
        optionId: "opt_a",
        priceCatalogId: otherCatalog.id,
        name: "Option A other-catalog default",
        isDefault: true,
        active: true,
      }),
    )

    expect(await countDefaults("opt_a", catalog.id)).toHaveLength(1)
    expect((await countDefaults("opt_a", catalog.id))[0]?.id).toBe(keep?.id)
    expect((await countDefaults("opt_b", catalog.id))[0]?.id).toBe(otherOption?.id)
    expect((await countDefaults("opt_a", otherCatalog.id))[0]?.id).toBe(otherCatalogRule?.id)
  })

  it("demotes prior defaults when an existing plan is promoted via update", async () => {
    const catalog = await seedCatalog("PUB-EUR-4")
    const productId = "prod_promote"
    const optionId = "opt_promote"

    const original = await createOptionPriceRule(
      db,
      ruleInput({
        productId,
        optionId,
        priceCatalogId: catalog.id,
        name: "Original default",
        isDefault: true,
        active: true,
      }),
    )
    const secondary = await createOptionPriceRule(
      db,
      ruleInput({
        productId,
        optionId,
        priceCatalogId: catalog.id,
        name: "Secondary",
        isDefault: false,
        active: true,
      }),
    )

    await updateOptionPriceRule(db, secondary?.id ?? "", { isDefault: true })

    const defaults = await countDefaults(optionId, catalog.id)
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.id).toBe(secondary?.id)

    const all = await listOptionPriceRules(db, { optionId, limit: 50, offset: 0 })
    const demoted = all.data.find((rule) => rule.id === original?.id)
    expect(demoted?.isDefault).toBe(false)
  })
})
