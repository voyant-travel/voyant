import { describe, expect, it } from "vitest"

import {
  optionId,
  productId,
  req,
  seedOptionPriceRule,
  seedOptionStartTimeRule,
  seedOptionUnitPriceRule,
  seedOptionUnitTier,
  seedPriceCatalog,
  startTimeId,
  unitId,
} from "./routes.test-support.js"

export function registerOptionRuleSuites() {
  describe("Option Price Rules", () => {
    it("GET /option-price-rules returns empty list", async () => {
      const res = await req("GET", "/option-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-price-rules creates a rule", async () => {
      const catalog = await seedPriceCatalog()
      const res = await req("POST", "/option-price-rules", {
        productId,
        optionId,
        priceCatalogId: catalog.id,
        name: "Standard Price",
        pricingMode: "per_person",
        baseSellAmountCents: 5000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; name: string; pricingMode: string; baseSellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^oprr_/)
      expect(json.data.name).toBe("Standard Price")
      expect(json.data.pricingMode).toBe("per_person")
      expect(json.data.baseSellAmountCents).toBe(5000)
    })

    it("GET /option-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("GET", `/option-price-rules/${rule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(rule.id)
    })

    it("GET /option-price-rules/:id returns 404 for missing", async () => {
      const res = await req("GET", "/option-price-rules/oprr_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /option-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("PATCH", `/option-price-rules/${rule.id}`, {
        name: "Updated Price",
        pricingMode: "per_booking",
        baseSellAmountCents: 10000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { name: string; pricingMode: string; baseSellAmountCents: number }
      }
      expect(json.data.name).toBe("Updated Price")
      expect(json.data.pricingMode).toBe("per_booking")
      expect(json.data.baseSellAmountCents).toBe(10000)
    })

    it("DELETE /option-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const del = await req("DELETE", `/option-price-rules/${rule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-price-rules/${rule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by productId", async () => {
      await seedOptionPriceRule()
      const res = await req("GET", `/option-price-rules?productId=${productId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by pricingMode", async () => {
      await seedOptionPriceRule({ pricingMode: "per_person" })
      await seedOptionPriceRule({ pricingMode: "free" })
      const res = await req("GET", "/option-price-rules?pricingMode=free")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("PATCH /option-price-rules/:id rejects switching to per_booking when unit prices exist", async () => {
      const rule = await seedOptionPriceRule({ pricingMode: "per_person" })
      await seedOptionUnitPriceRule(rule.id)
      const res = await req("PATCH", `/option-price-rules/${rule.id}`, {
        pricingMode: "per_booking",
      })
      expect(res.status).toBe(400)
      const json = (await res.json()) as { error: string }
      expect(json.error).toMatch(/per_booking/)
    })
  })

  // ==================== Option Unit Price Rules ====================

  describe("Option Unit Price Rules", () => {
    it("GET /option-unit-price-rules returns empty list", async () => {
      const res = await req("GET", "/option-unit-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-unit-price-rules creates a unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/option-unit-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        unitId,
        pricingMode: "per_unit",
        sellAmountCents: 3000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^oupr_/)
      expect(json.data.pricingMode).toBe("per_unit")
      expect(json.data.sellAmountCents).toBe(3000)
    })

    it("GET /option-unit-price-rules/:id returns the unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const res = await req("GET", `/option-unit-price-rules/${unitRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(unitRule.id)
    })

    it("PATCH /option-unit-price-rules/:id updates the unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const res = await req("PATCH", `/option-unit-price-rules/${unitRule.id}`, {
        sellAmountCents: 4500,
        pricingMode: "per_person",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { sellAmountCents: number; pricingMode: string }
      }
      expect(json.data.sellAmountCents).toBe(4500)
      expect(json.data.pricingMode).toBe("per_person")
    })

    it("DELETE /option-unit-price-rules/:id deletes the unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const del = await req("DELETE", `/option-unit-price-rules/${unitRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-unit-price-rules/${unitRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionPriceRuleId", async () => {
      const rule1 = await seedOptionPriceRule()
      const rule2 = await seedOptionPriceRule()
      await seedOptionUnitPriceRule(rule1.id)
      await seedOptionUnitPriceRule(rule2.id)
      const res = await req("GET", `/option-unit-price-rules?optionPriceRuleId=${rule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("POST /option-unit-price-rules rejects unit prices under a per_booking parent", async () => {
      const rule = await seedOptionPriceRule({ pricingMode: "per_booking" })
      const res = await req("POST", "/option-unit-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        unitId,
        pricingMode: "per_unit",
        sellAmountCents: 3000,
      })
      expect(res.status).toBe(400)
      const json = (await res.json()) as { error: string }
      expect(json.error).toMatch(/per_booking/)
    })
  })

  // ==================== Option Start Time Rules ====================

  describe("Option Start Time Rules", () => {
    it("GET /option-start-time-rules returns empty list", async () => {
      const res = await req("GET", "/option-start-time-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-start-time-rules creates a start time rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/option-start-time-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        startTimeId,
        ruleMode: "included",
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as { data: { id: string; ruleMode: string } }
      expect(json.data.id).toMatch(/^ostr_/)
      expect(json.data.ruleMode).toBe("included")
    })

    it("GET /option-start-time-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const stRule = await seedOptionStartTimeRule(rule.id)
      const res = await req("GET", `/option-start-time-rules/${stRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(stRule.id)
    })

    it("PATCH /option-start-time-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const stRule = await seedOptionStartTimeRule(rule.id)
      const res = await req("PATCH", `/option-start-time-rules/${stRule.id}`, {
        ruleMode: "adjustment",
        adjustmentType: "percentage",
        adjustmentBasisPoints: 1000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { ruleMode: string; adjustmentType: string; adjustmentBasisPoints: number }
      }
      expect(json.data.ruleMode).toBe("adjustment")
      expect(json.data.adjustmentType).toBe("percentage")
      expect(json.data.adjustmentBasisPoints).toBe(1000)
    })

    it("DELETE /option-start-time-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const stRule = await seedOptionStartTimeRule(rule.id)
      const del = await req("DELETE", `/option-start-time-rules/${stRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-start-time-rules/${stRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionPriceRuleId", async () => {
      const rule1 = await seedOptionPriceRule()
      const rule2 = await seedOptionPriceRule()
      // Each gets a unique startTimeId so we need separate start times
      // But we only have one startTimeId, so we create the rule for rule1 only
      // and test that filter returns 1 vs 0
      await seedOptionStartTimeRule(rule1.id)
      const res = await req("GET", `/option-start-time-rules?optionPriceRuleId=${rule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
      const res2 = await req("GET", `/option-start-time-rules?optionPriceRuleId=${rule2.id}`)
      expect(res2.status).toBe(200)
      const json2 = (await res2.json()) as { data: unknown[]; total: number }
      expect(json2.total).toBe(0)
    })
  })

  // ==================== Option Unit Tiers ====================

  describe("Option Unit Tiers", () => {
    it("GET /option-unit-tiers returns empty list", async () => {
      const res = await req("GET", "/option-unit-tiers")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-unit-tiers creates a tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const res = await req("POST", "/option-unit-tiers", {
        optionUnitPriceRuleId: unitRule.id,
        minQuantity: 1,
        maxQuantity: 5,
        sellAmountCents: 5000,
        costAmountCents: 3000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; minQuantity: number; maxQuantity: number }
      }
      expect(json.data.id).toMatch(/^outi_/)
      expect(json.data.minQuantity).toBe(1)
      expect(json.data.maxQuantity).toBe(5)
    })

    it("GET /option-unit-tiers/:id returns the tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const tier = await seedOptionUnitTier(unitRule.id)
      const res = await req("GET", `/option-unit-tiers/${tier.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(tier.id)
    })

    it("PATCH /option-unit-tiers/:id updates the tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const tier = await seedOptionUnitTier(unitRule.id)
      const res = await req("PATCH", `/option-unit-tiers/${tier.id}`, {
        minQuantity: 6,
        maxQuantity: 10,
        sellAmountCents: 4000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { minQuantity: number; maxQuantity: number; sellAmountCents: number }
      }
      expect(json.data.minQuantity).toBe(6)
      expect(json.data.maxQuantity).toBe(10)
      expect(json.data.sellAmountCents).toBe(4000)
    })

    it("DELETE /option-unit-tiers/:id deletes the tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const tier = await seedOptionUnitTier(unitRule.id)
      const del = await req("DELETE", `/option-unit-tiers/${tier.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-unit-tiers/${tier.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionUnitPriceRuleId", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule1 = await seedOptionUnitPriceRule(rule.id)
      await seedOptionUnitTier(unitRule1.id)
      await seedOptionUnitTier(unitRule1.id, { minQuantity: 6 })
      const res = await req("GET", `/option-unit-tiers?optionUnitPriceRuleId=${unitRule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(2)
    })
  })

  // ==================== Pickup Price Rules ====================
}
