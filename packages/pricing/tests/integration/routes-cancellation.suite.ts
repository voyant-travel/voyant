import { describe, expect, it } from "vitest"

import { req, seedCancellationPolicy, seedCancellationPolicyRule } from "./routes.test-support.js"

export function registerCancellationSuites() {
  describe("Cancellation Policies", () => {
    it("GET /cancellation-policies returns empty list", async () => {
      const res = await req("GET", "/cancellation-policies")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /cancellation-policies creates a policy", async () => {
      const res = await req("POST", "/cancellation-policies", {
        name: "24h Cancel",
        policyType: "simple",
        simpleCutoffHours: 24,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; name: string; policyType: string }
      }
      expect(json.data.id).toMatch(/^ccpo_/)
      expect(json.data.name).toBe("24h Cancel")
      expect(json.data.policyType).toBe("simple")
    })

    it("GET /cancellation-policies/:id returns the policy", async () => {
      const pol = await seedCancellationPolicy()
      const res = await req("GET", `/cancellation-policies/${pol.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(pol.id)
    })

    it("GET /cancellation-policies/:id returns 404 for missing", async () => {
      const res = await req("GET", "/cancellation-policies/ccpo_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /cancellation-policies/:id updates the policy", async () => {
      const pol = await seedCancellationPolicy()
      const res = await req("PATCH", `/cancellation-policies/${pol.id}`, {
        name: "Updated Policy",
        policyType: "non_refundable",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { name: string; policyType: string } }
      expect(json.data.name).toBe("Updated Policy")
      expect(json.data.policyType).toBe("non_refundable")
    })

    it("DELETE /cancellation-policies/:id deletes the policy", async () => {
      const pol = await seedCancellationPolicy()
      const del = await req("DELETE", `/cancellation-policies/${pol.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/cancellation-policies/${pol.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by policyType", async () => {
      await seedCancellationPolicy({ policyType: "simple" })
      await seedCancellationPolicy({ policyType: "advanced" })
      const res = await req("GET", "/cancellation-policies?policyType=simple")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by search", async () => {
      await seedCancellationPolicy({ name: "FlexCancel" })
      await seedCancellationPolicy({ name: "StrictCancel" })
      const res = await req("GET", "/cancellation-policies?search=Flex")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Cancellation Policy Rules ====================

  describe("Cancellation Policy Rules", () => {
    it("GET /cancellation-policy-rules returns empty list", async () => {
      const res = await req("GET", "/cancellation-policy-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /cancellation-policy-rules creates a rule", async () => {
      const pol = await seedCancellationPolicy()
      const res = await req("POST", "/cancellation-policy-rules", {
        cancellationPolicyId: pol.id,
        chargeType: "percentage",
        chargePercentBasisPoints: 5000,
        cutoffMinutesBefore: 1440,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; chargeType: string; chargePercentBasisPoints: number }
      }
      expect(json.data.id).toMatch(/^ccpr_/)
      expect(json.data.chargeType).toBe("percentage")
      expect(json.data.chargePercentBasisPoints).toBe(5000)
    })

    it("GET /cancellation-policy-rules/:id returns the rule", async () => {
      const pol = await seedCancellationPolicy()
      const rule = await seedCancellationPolicyRule(pol.id)
      const res = await req("GET", `/cancellation-policy-rules/${rule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(rule.id)
    })

    it("PATCH /cancellation-policy-rules/:id updates the rule", async () => {
      const pol = await seedCancellationPolicy()
      const rule = await seedCancellationPolicyRule(pol.id)
      const res = await req("PATCH", `/cancellation-policy-rules/${rule.id}`, {
        chargeType: "amount",
        chargeAmountCents: 2500,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { chargeType: string; chargeAmountCents: number }
      }
      expect(json.data.chargeType).toBe("amount")
      expect(json.data.chargeAmountCents).toBe(2500)
    })

    it("DELETE /cancellation-policy-rules/:id deletes the rule", async () => {
      const pol = await seedCancellationPolicy()
      const rule = await seedCancellationPolicyRule(pol.id)
      const del = await req("DELETE", `/cancellation-policy-rules/${rule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/cancellation-policy-rules/${rule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by cancellationPolicyId", async () => {
      const pol1 = await seedCancellationPolicy()
      const pol2 = await seedCancellationPolicy()
      await seedCancellationPolicyRule(pol1.id)
      await seedCancellationPolicyRule(pol2.id)
      const res = await req("GET", `/cancellation-policy-rules?cancellationPolicyId=${pol1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Price Catalogs ====================
}
