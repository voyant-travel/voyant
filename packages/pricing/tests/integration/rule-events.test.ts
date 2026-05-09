import { createEventBus } from "@voyantjs/core"
import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { PRICING_RULE_CHANGED_EVENT, type PricingRuleChangedEvent } from "../../src/events.js"
import { priceCatalogs } from "../../src/schema-catalogs.js"
import { optionPriceRules, optionUnitPriceRules } from "../../src/schema-option-rules.js"
import {
  createOptionPriceRule,
  createOptionUnitPriceRule,
  deleteOptionPriceRule,
  deleteOptionUnitPriceRule,
  updateOptionPriceRule,
  updateOptionUnitPriceRule,
} from "../../src/service-option-rules.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("pricing rule events", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle test client
  let db: any
  let productId: string
  let optionId: string
  let unitId: string
  let catalogId: string

  beforeAll(() => {
    db = createTestDb()
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
    productId = newId("products")
    optionId = newId("product_options")
    unitId = newId("option_units")
    catalogId = newId("price_catalogs")

    await db.insert(products).values({
      id: productId,
      name: "Pricing Event Test Product",
      sellCurrency: "USD",
      bookingMode: "date",
    })
    await db
      .insert(productOptions)
      .values({ id: optionId, productId, name: "Standard", code: "std" })
    await db.insert(optionUnits).values({ id: unitId, optionId, name: "Adult", code: "adult" })
    await db.insert(priceCatalogs).values({
      id: catalogId,
      name: "Public USD",
      code: "public-usd",
      currencyCode: "USD",
    })
  })

  function recordingBus() {
    const bus = createEventBus()
    const events: PricingRuleChangedEvent[] = []
    bus.subscribe<PricingRuleChangedEvent>(PRICING_RULE_CHANGED_EVENT, ({ data }) => {
      events.push(data)
    })
    return { bus, events }
  }

  describe("option-rule mutations", () => {
    it("createOptionPriceRule emits with source='created' and the productId", async () => {
      const { bus, events } = recordingBus()
      const created = await createOptionPriceRule(
        db,
        {
          productId,
          optionId,
          priceCatalogId: catalogId,
          name: "default",
          baseSellAmountCents: 9900,
          isDefault: true,
          active: true,
        },
        { eventBus: bus },
      )
      expect(created).toBeDefined()
      expect(events).toHaveLength(1)
      expect(events[0]?.source).toBe("created")
      expect(events[0]?.kind).toBe("option-rule")
      expect(events[0]?.productId).toBe(productId)
      expect(events[0]?.ruleId).toBe(created?.id)
    })

    it("updateOptionPriceRule emits with source='updated'", async () => {
      const ruleId = newId("option_price_rules")
      await db.insert(optionPriceRules).values({
        id: ruleId,
        productId,
        optionId,
        priceCatalogId: catalogId,
        name: "default",
        baseSellAmountCents: 9900,
        isDefault: true,
        active: true,
      })

      const { bus, events } = recordingBus()
      await updateOptionPriceRule(db, ruleId, { baseSellAmountCents: 8800 }, { eventBus: bus })
      expect(events).toHaveLength(1)
      expect(events[0]?.source).toBe("updated")
      expect(events[0]?.productId).toBe(productId)
    })

    it("updateOptionPriceRule reassigning productId emits for BOTH old and new product", async () => {
      // Operator moves a rule between products (rare, but the update
      // schema allows it). Both products' projections must reindex —
      // old product loses the rule from its MIN, new product gains it.
      const otherProductId = newId("products")
      const otherOptionId = newId("product_options")
      await db.insert(products).values({
        id: otherProductId,
        name: "Receiving Product",
        sellCurrency: "USD",
        bookingMode: "date",
      })
      await db
        .insert(productOptions)
        .values({ id: otherOptionId, productId: otherProductId, name: "Std", code: "std" })

      const ruleId = newId("option_price_rules")
      await db.insert(optionPriceRules).values({
        id: ruleId,
        productId,
        optionId,
        priceCatalogId: catalogId,
        name: "moving-rule",
        baseSellAmountCents: 9900,
        isDefault: true,
        active: true,
      })

      const { bus, events } = recordingBus()
      await updateOptionPriceRule(
        db,
        ruleId,
        { productId: otherProductId, optionId: otherOptionId },
        { eventBus: bus },
      )
      expect(events).toHaveLength(2)
      const productIds = events.map((e) => e.productId).sort()
      expect(productIds).toEqual([otherProductId, productId].sort())
    })

    it("deleteOptionPriceRule emits with source='deleted' (snapshots productId before delete)", async () => {
      const ruleId = newId("option_price_rules")
      await db.insert(optionPriceRules).values({
        id: ruleId,
        productId,
        optionId,
        priceCatalogId: catalogId,
        name: "default",
        baseSellAmountCents: 9900,
        isDefault: true,
        active: true,
      })

      const { bus, events } = recordingBus()
      const deleted = await deleteOptionPriceRule(db, ruleId, { eventBus: bus })
      expect(deleted).toBeDefined()
      expect(events).toHaveLength(1)
      expect(events[0]?.source).toBe("deleted")
      expect(events[0]?.productId).toBe(productId)
    })

    it("deleteOptionPriceRule is a no-op (no event) when the rule doesn't exist", async () => {
      const { bus, events } = recordingBus()
      const result = await deleteOptionPriceRule(db, "option_price_rules_nonexistent", {
        eventBus: bus,
      })
      expect(result).toBeNull()
      expect(events).toHaveLength(0)
    })
  })

  describe("option-unit-rule mutations (productId resolved via parent rule)", () => {
    let parentRuleId: string

    beforeEach(async () => {
      parentRuleId = newId("option_price_rules")
      await db.insert(optionPriceRules).values({
        id: parentRuleId,
        productId,
        optionId,
        priceCatalogId: catalogId,
        name: "per-unit-parent",
        // Per-unit pricing — flat base is null.
        baseSellAmountCents: null,
        pricingMode: "per_person",
        isDefault: true,
        active: true,
      })
    })

    it("createOptionUnitPriceRule emits 'option-unit-rule' kind with parent's productId", async () => {
      const { bus, events } = recordingBus()
      const created = await createOptionUnitPriceRule(
        db,
        {
          optionPriceRuleId: parentRuleId,
          optionId,
          unitId,
          sellAmountCents: 8500,
          active: true,
        },
        { eventBus: bus },
      )
      expect(created).toBeDefined()
      expect(events).toHaveLength(1)
      expect(events[0]?.kind).toBe("option-unit-rule")
      expect(events[0]?.source).toBe("created")
      expect(events[0]?.productId).toBe(productId)
    })

    it("updateOptionUnitPriceRule emits with the resolved productId", async () => {
      const unitRuleId = newId("option_unit_price_rules")
      await db.insert(optionUnitPriceRules).values({
        id: unitRuleId,
        optionPriceRuleId: parentRuleId,
        optionId,
        unitId,
        sellAmountCents: 8500,
        active: true,
      })

      const { bus, events } = recordingBus()
      await updateOptionUnitPriceRule(db, unitRuleId, { sellAmountCents: 7700 }, { eventBus: bus })
      expect(events).toHaveLength(1)
      expect(events[0]?.kind).toBe("option-unit-rule")
      expect(events[0]?.source).toBe("updated")
      expect(events[0]?.productId).toBe(productId)
    })

    it("updateOptionUnitPriceRule reassigning to a parent on a different product emits for BOTH products", async () => {
      // Move a unit-rule from parentRuleId (under productId) to a new
      // parent under a different product. Both products' MINs change.
      const otherProductId = newId("products")
      const otherOptionId = newId("product_options")
      const otherUnitId = newId("option_units")
      const otherParentRuleId = newId("option_price_rules")
      await db.insert(products).values({
        id: otherProductId,
        name: "Receiving Product",
        sellCurrency: "USD",
        bookingMode: "date",
      })
      await db
        .insert(productOptions)
        .values({ id: otherOptionId, productId: otherProductId, name: "Std", code: "std" })
      await db
        .insert(optionUnits)
        .values({ id: otherUnitId, optionId: otherOptionId, name: "Adult", code: "adult" })
      await db.insert(optionPriceRules).values({
        id: otherParentRuleId,
        productId: otherProductId,
        optionId: otherOptionId,
        priceCatalogId: catalogId,
        name: "other-parent",
        baseSellAmountCents: null,
        pricingMode: "per_person",
        isDefault: true,
        active: true,
      })

      const unitRuleId = newId("option_unit_price_rules")
      await db.insert(optionUnitPriceRules).values({
        id: unitRuleId,
        optionPriceRuleId: parentRuleId,
        optionId,
        unitId,
        sellAmountCents: 8500,
        active: true,
      })

      const { bus, events } = recordingBus()
      await updateOptionUnitPriceRule(
        db,
        unitRuleId,
        {
          optionPriceRuleId: otherParentRuleId,
          optionId: otherOptionId,
          unitId: otherUnitId,
        },
        { eventBus: bus },
      )
      expect(events).toHaveLength(2)
      const productIds = events.map((e) => e.productId).sort()
      expect(productIds).toEqual([otherProductId, productId].sort())
    })

    it("deleteOptionUnitPriceRule snapshots productId before deletion", async () => {
      const unitRuleId = newId("option_unit_price_rules")
      await db.insert(optionUnitPriceRules).values({
        id: unitRuleId,
        optionPriceRuleId: parentRuleId,
        optionId,
        unitId,
        sellAmountCents: 8500,
        active: true,
      })

      const { bus, events } = recordingBus()
      const deleted = await deleteOptionUnitPriceRule(db, unitRuleId, { eventBus: bus })
      expect(deleted).toBeDefined()
      expect(events).toHaveLength(1)
      expect(events[0]?.kind).toBe("option-unit-rule")
      expect(events[0]?.source).toBe("deleted")
      expect(events[0]?.productId).toBe(productId)
    })
  })

  it("mutations called without an eventBus stay silent (back-compat)", async () => {
    // No runtime arg → no event. Existing callers that don't care about
    // the catalog plane keep working unchanged.
    const created = await createOptionPriceRule(db, {
      productId,
      optionId,
      priceCatalogId: catalogId,
      name: "no-bus",
      baseSellAmountCents: 5000,
      isDefault: true,
      active: true,
    })
    expect(created).toBeDefined()
    // Nothing to assert other than: this didn't throw.
  })
})
