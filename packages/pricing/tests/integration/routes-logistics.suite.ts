import { describe, expect, it } from "vitest"

import {
  facilityId,
  optionExtraConfigId,
  optionId,
  pickupPointId,
  productExtraId,
  req,
  seedDropoffPriceRule,
  seedExtraPriceRule,
  seedOptionPriceRule,
  seedPickupPriceRule,
} from "./routes.test-support.js"

export function registerLogisticsSuites() {
  describe("Pickup Price Rules", () => {
    it("GET /pickup-price-rules returns empty list", async () => {
      const res = await req("GET", "/pickup-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /pickup-price-rules creates a pickup price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/pickup-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        pickupPointId,
        pricingMode: "per_person",
        sellAmountCents: 1500,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^pkpr_/)
      expect(json.data.pricingMode).toBe("per_person")
      expect(json.data.sellAmountCents).toBe(1500)
    })

    it("GET /pickup-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const pkRule = await seedPickupPriceRule(rule.id)
      const res = await req("GET", `/pickup-price-rules/${pkRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(pkRule.id)
    })

    it("PATCH /pickup-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const pkRule = await seedPickupPriceRule(rule.id)
      const res = await req("PATCH", `/pickup-price-rules/${pkRule.id}`, {
        pricingMode: "per_booking",
        sellAmountCents: 2500,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.pricingMode).toBe("per_booking")
      expect(json.data.sellAmountCents).toBe(2500)
    })

    it("DELETE /pickup-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const pkRule = await seedPickupPriceRule(rule.id)
      const del = await req("DELETE", `/pickup-price-rules/${pkRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/pickup-price-rules/${pkRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionPriceRuleId", async () => {
      const rule1 = await seedOptionPriceRule()
      const rule2 = await seedOptionPriceRule()
      await seedPickupPriceRule(rule1.id)
      const res = await req("GET", `/pickup-price-rules?optionPriceRuleId=${rule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
      const res2 = await req("GET", `/pickup-price-rules?optionPriceRuleId=${rule2.id}`)
      expect(res2.status).toBe(200)
      const json2 = (await res2.json()) as { data: unknown[]; total: number }
      expect(json2.total).toBe(0)
    })
  })

  // ==================== Dropoff Price Rules ====================

  describe("Dropoff Price Rules", () => {
    it("GET /dropoff-price-rules returns empty list", async () => {
      const res = await req("GET", "/dropoff-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /dropoff-price-rules creates a dropoff price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/dropoff-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        dropoffName: "Airport Terminal",
        facilityId,
        pricingMode: "per_person",
        sellAmountCents: 2000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; dropoffName: string; pricingMode: string }
      }
      expect(json.data.id).toMatch(/^drpr_/)
      expect(json.data.dropoffName).toBe("Airport Terminal")
      expect(json.data.pricingMode).toBe("per_person")
    })

    it("GET /dropoff-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const drRule = await seedDropoffPriceRule(rule.id)
      const res = await req("GET", `/dropoff-price-rules/${drRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(drRule.id)
    })

    it("PATCH /dropoff-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const drRule = await seedDropoffPriceRule(rule.id)
      const res = await req("PATCH", `/dropoff-price-rules/${drRule.id}`, {
        dropoffName: "Updated Terminal",
        pricingMode: "per_booking",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { dropoffName: string; pricingMode: string } }
      expect(json.data.dropoffName).toBe("Updated Terminal")
      expect(json.data.pricingMode).toBe("per_booking")
    })

    it("DELETE /dropoff-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const drRule = await seedDropoffPriceRule(rule.id)
      const del = await req("DELETE", `/dropoff-price-rules/${drRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/dropoff-price-rules/${drRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by facilityId", async () => {
      const rule = await seedOptionPriceRule()
      await seedDropoffPriceRule(rule.id, { facilityId })
      await seedDropoffPriceRule(rule.id, { facilityId: null })
      const res = await req("GET", `/dropoff-price-rules?facilityId=${facilityId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Extra Price Rules ====================

  describe("Extra Price Rules", () => {
    it("GET /extra-price-rules returns empty list", async () => {
      const res = await req("GET", "/extra-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /extra-price-rules creates an extra price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/extra-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        productExtraId,
        optionExtraConfigId,
        pricingMode: "per_person",
        sellAmountCents: 1000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^expr_/)
      expect(json.data.pricingMode).toBe("per_person")
      expect(json.data.sellAmountCents).toBe(1000)
    })

    it("GET /extra-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const exRule = await seedExtraPriceRule(rule.id)
      const res = await req("GET", `/extra-price-rules/${exRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(exRule.id)
    })

    it("PATCH /extra-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const exRule = await seedExtraPriceRule(rule.id)
      const res = await req("PATCH", `/extra-price-rules/${exRule.id}`, {
        pricingMode: "per_booking",
        sellAmountCents: 3000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.pricingMode).toBe("per_booking")
      expect(json.data.sellAmountCents).toBe(3000)
    })

    it("DELETE /extra-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const exRule = await seedExtraPriceRule(rule.id)
      const del = await req("DELETE", `/extra-price-rules/${exRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/extra-price-rules/${exRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by productExtraId", async () => {
      const rule = await seedOptionPriceRule()
      await seedExtraPriceRule(rule.id, { productExtraId })
      await seedExtraPriceRule(rule.id, { productExtraId: null })
      const res = await req("GET", `/extra-price-rules?productExtraId=${productExtraId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by optionExtraConfigId", async () => {
      const rule = await seedOptionPriceRule()
      await seedExtraPriceRule(rule.id, { optionExtraConfigId })
      await seedExtraPriceRule(rule.id, { optionExtraConfigId: null })
      const res = await req("GET", `/extra-price-rules?optionExtraConfigId=${optionExtraConfigId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })
}
