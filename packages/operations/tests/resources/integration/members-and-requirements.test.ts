import { describe, expect, it } from "vitest"

import { createResourcesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Pool membership and requirement routes", () => {
  const ctx = createResourcesTestContext()

  describe("Resource Pool Members", () => {
    it("POST /pool-members → 201", async () => {
      const resource = await ctx.seedResource()
      const pool = await ctx.seedPool()
      const member = await ctx.seedPoolMember(pool.id, resource.id)
      expect(member.id).toMatch(/^repm_/)
      expect(member.poolId).toBe(pool.id)
      expect(member.resourceId).toBe(resource.id)
    })

    it("DELETE /pool-members/:id → 200", async () => {
      const resource = await ctx.seedResource()
      const pool = await ctx.seedPool()
      const member = await ctx.seedPoolMember(pool.id, resource.id)
      const res = await ctx.request(`/pool-members/${member.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /pool-members/:id → 404 for missing", async () => {
      const res = await ctx.request("/pool-members/repm_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /pool-members → list by poolId", async () => {
      const resource1 = await ctx.seedResource()
      const resource2 = await ctx.seedResource()
      const pool = await ctx.seedPool()
      await ctx.seedPoolMember(pool.id, resource1.id)
      await ctx.seedPoolMember(pool.id, resource2.id)

      const res = await ctx.request(`/pool-members?poolId=${pool.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /pool-members → filter by resourceId", async () => {
      const resource1 = await ctx.seedResource()
      const resource2 = await ctx.seedResource()
      const pool = await ctx.seedPool()
      await ctx.seedPoolMember(pool.id, resource1.id)
      await ctx.seedPoolMember(pool.id, resource2.id)

      const res = await ctx.request(`/pool-members?resourceId=${resource1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].resourceId).toBe(resource1.id)
    })
  })

  describe("Resource Requirements", () => {
    it("POST /requirements → 201", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const requirement = await ctx.seedRequirement(pool.id, product.id)
      expect(requirement.id).toMatch(/^rerq_/)
      expect(requirement.poolId).toBe(pool.id)
      expect(requirement.productId).toBe(product.id)
      expect(requirement.quantityRequired).toBe(1)
      expect(requirement.allocationMode).toBe("shared")
    })

    it("GET /requirements/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const requirement = await ctx.seedRequirement(pool.id, product.id)
      const res = await ctx.request(`/requirements/${requirement.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(requirement.id)
    })

    it("GET /requirements/:id → 404 for missing", async () => {
      const res = await ctx.request("/requirements/rerq_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /requirements/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const requirement = await ctx.seedRequirement(pool.id, product.id)
      const res = await ctx.request(`/requirements/${requirement.id}`, {
        method: "PATCH",
        ...json({ quantityRequired: 3, allocationMode: "exclusive", priority: 5 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.quantityRequired).toBe(3)
      expect(body.data.allocationMode).toBe("exclusive")
      expect(body.data.priority).toBe(5)
    })

    it("PATCH /requirements/:id → 404 for missing", async () => {
      const res = await ctx.request("/requirements/rerq_nonexistent", {
        method: "PATCH",
        ...json({ quantityRequired: 5 }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /requirements/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const requirement = await ctx.seedRequirement(pool.id, product.id)
      const res = await ctx.request(`/requirements/${requirement.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /requirements/:id → 404 for missing", async () => {
      const res = await ctx.request("/requirements/rerq_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /requirements → list with filters", async () => {
      const product = await ctx.seedProductDirect()
      const pool1 = await ctx.seedPool()
      const pool2 = await ctx.seedPool()
      await ctx.seedRequirement(pool1.id, product.id)
      await ctx.seedRequirement(pool2.id, product.id)

      const res = await ctx.request(`/requirements?poolId=${pool1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it("GET /requirements → filter by productId", async () => {
      const product1 = await ctx.seedProductDirect()
      const product2 = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      await ctx.seedRequirement(pool.id, product1.id)
      await ctx.seedRequirement(pool.id, product2.id)

      const res = await ctx.request(`/requirements?productId=${product1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].productId).toBe(product1.id)
    })

    it("POST /requirements/batch-update → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const r1 = await ctx.seedRequirement(pool.id, product.id)
      const r2 = await ctx.seedRequirement(pool.id, product.id, { priority: 1 })
      const res = await ctx.request("/requirements/batch-update", {
        method: "POST",
        ...json({ ids: [r1.id, r2.id], patch: { priority: 10 } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("POST /requirements/batch-delete → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const r1 = await ctx.seedRequirement(pool.id, product.id)
      const r2 = await ctx.seedRequirement(pool.id, product.id, { priority: 1 })
      const res = await ctx.request("/requirements/batch-delete", {
        method: "POST",
        ...json({ ids: [r1.id, r2.id] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })
  })

  describe("Allocations (alias)", () => {
    it("POST /allocations → 201", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const res = await ctx.request("/allocations", {
        method: "POST",
        ...json({ poolId: pool.id, productId: product.id }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.id).toMatch(/^rerq_/)
    })

    it("GET /allocations/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const requirement = await ctx.seedRequirement(pool.id, product.id)
      const res = await ctx.request(`/allocations/${requirement.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(requirement.id)
    })

    it("PATCH /allocations/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const requirement = await ctx.seedRequirement(pool.id, product.id)
      const res = await ctx.request(`/allocations/${requirement.id}`, {
        method: "PATCH",
        ...json({ priority: 99 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.priority).toBe(99)
    })

    it("DELETE /allocations/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      const requirement = await ctx.seedRequirement(pool.id, product.id)
      const res = await ctx.request(`/allocations/${requirement.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("GET /allocations → list", async () => {
      const product = await ctx.seedProductDirect()
      const pool = await ctx.seedPool()
      await ctx.seedRequirement(pool.id, product.id)
      const res = await ctx.request("/allocations")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })
  })
})
