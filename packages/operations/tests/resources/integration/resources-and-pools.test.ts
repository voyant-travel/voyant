import { describe, expect, it } from "vitest"

import { createResourcesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Resources and pools routes", () => {
  const ctx = createResourcesTestContext()

  describe("Resources", () => {
    it("POST /operations → 201", async () => {
      const resource = await ctx.seedResource()
      expect(resource.id).toMatch(/^res_/)
      expect(resource.kind).toBe("guide")
      expect(resource.name).toBe("Resource 0001")
      expect(resource.active).toBe(true)
    })

    it("GET /operations/:id → 200", async () => {
      const resource = await ctx.seedResource()
      const res = await ctx.request(`/operations/${resource.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(resource.id)
    })

    it("GET /operations/:id → 404 for missing", async () => {
      const res = await ctx.request("/operations")
      expect(res.status).toBe(404)
    })

    it("PATCH /operations/:id → 200", async () => {
      const resource = await ctx.seedResource()
      const res = await ctx.request(`/operations/${resource.id}`, {
        method: "PATCH",
        ...json({ name: "Updated", kind: "vehicle", capacity: 10 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe("Updated")
      expect(body.data.kind).toBe("vehicle")
      expect(body.data.capacity).toBe(10)
    })

    it("PATCH /operations/:id → 404 for missing", async () => {
      const res = await ctx.request("/operations", {
        method: "PATCH",
        ...json({ name: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /operations/:id → 200", async () => {
      const resource = await ctx.seedResource()
      const res = await ctx.request(`/operations/${resource.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await ctx.request(`/operations/${resource.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /operations/:id → 404 for missing", async () => {
      const res = await ctx.request("/operations", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /operations → list with pagination", async () => {
      await ctx.seedResource()
      await ctx.seedResource()
      const res = await ctx.request("/operations?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /operations → filter by kind", async () => {
      await ctx.seedResource({ kind: "guide" })
      await ctx.seedResource({ kind: "vehicle" })
      const res = await ctx.request("/operations?kind=vehicle")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].kind).toBe("vehicle")
    })

    it("GET /operations → filter by active", async () => {
      await ctx.seedResource({ active: true })
      await ctx.seedResource({ active: false })
      const res = await ctx.request("/operations?active=false")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].active).toBe(false)
    })

    it("POST /operations → 200", async () => {
      const r1 = await ctx.seedResource()
      const r2 = await ctx.seedResource()
      const res = await ctx.request("/operations", {
        method: "POST",
        ...json({ ids: [r1.id, r2.id], patch: { active: false } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
      expect(body.data).toHaveLength(2)
      for (const row of body.data) {
        expect(row.active).toBe(false)
      }
    })

    it("POST /operations → partial failures", async () => {
      const resource = await ctx.seedResource()
      const res = await ctx.request("/operations", {
        method: "POST",
        ...json({ ids: [resource.id, "res_nonexistent"], patch: { active: false } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(1)
      expect(body.failed).toHaveLength(1)
      expect(body.failed[0].id).toBe("res_nonexistent")
    })

    it("POST /operations → 200", async () => {
      const r1 = await ctx.seedResource()
      const r2 = await ctx.seedResource()
      const res = await ctx.request("/operations", {
        method: "POST",
        ...json({ ids: [r1.id, r2.id] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
      expect(body.deletedIds).toHaveLength(2)
    })

    it("POST /operations → partial failures", async () => {
      const resource = await ctx.seedResource()
      const res = await ctx.request("/operations", {
        method: "POST",
        ...json({ ids: [resource.id, "res_nonexistent"] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(1)
      expect(body.failed).toHaveLength(1)
    })
  })

  describe("Resource Pools", () => {
    it("POST /pools → 201", async () => {
      const pool = await ctx.seedPool()
      expect(pool.id).toMatch(/^repl_/)
      expect(pool.kind).toBe("guide")
      expect(pool.name).toBe("Pool 0001")
      expect(pool.active).toBe(true)
    })

    it("GET /pools/:id → 200", async () => {
      const pool = await ctx.seedPool()
      const res = await ctx.request(`/pools/${pool.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(pool.id)
    })

    it("GET /pools/:id → 404 for missing", async () => {
      const res = await ctx.request("/pools/repl_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /pools/:id → 200", async () => {
      const pool = await ctx.seedPool()
      const res = await ctx.request(`/pools/${pool.id}`, {
        method: "PATCH",
        ...json({ name: "Updated Pool", sharedCapacity: 20 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe("Updated Pool")
      expect(body.data.sharedCapacity).toBe(20)
    })

    it("PATCH /pools/:id → 404 for missing", async () => {
      const res = await ctx.request("/pools/repl_nonexistent", {
        method: "PATCH",
        ...json({ name: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /pools/:id → 200", async () => {
      const pool = await ctx.seedPool()
      const res = await ctx.request(`/pools/${pool.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await ctx.request(`/pools/${pool.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /pools/:id → 404 for missing", async () => {
      const res = await ctx.request("/pools/repl_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /pools → list with pagination", async () => {
      await ctx.seedPool()
      await ctx.seedPool()
      const res = await ctx.request("/pools?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /pools → filter by kind", async () => {
      await ctx.seedPool({ kind: "guide" })
      await ctx.seedPool({ kind: "vehicle" })
      const res = await ctx.request("/pools?kind=vehicle")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].kind).toBe("vehicle")
    })

    it("GET /pools → filter by active", async () => {
      await ctx.seedPool({ active: true })
      await ctx.seedPool({ active: false })
      const res = await ctx.request("/pools?active=false")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].active).toBe(false)
    })

    it("POST /pools/batch-update → 200", async () => {
      const p1 = await ctx.seedPool()
      const p2 = await ctx.seedPool()
      const res = await ctx.request("/pools/batch-update", {
        method: "POST",
        ...json({ ids: [p1.id, p2.id], patch: { active: false } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("POST /pools/batch-delete → 200", async () => {
      const p1 = await ctx.seedPool()
      const p2 = await ctx.seedPool()
      const res = await ctx.request("/pools/batch-delete", {
        method: "POST",
        ...json({ ids: [p1.id, p2.id] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })
  })
})
