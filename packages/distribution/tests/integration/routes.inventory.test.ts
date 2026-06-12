import { describe, expect, it } from "vitest"

import { DB_AVAILABLE, json, setupDistributionRoutes } from "./routes.setup.js"

describe.skipIf(!DB_AVAILABLE)("Distribution inventory routes", () => {
  const ctx = setupDistributionRoutes()

  describe("Inventory Allotments CRUD", () => {
    it("creates an inventory allotment", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const res = await ctx.app.request("/inventory-allotments", {
        method: "POST",
        ...json({
          channelId: channel.id,
          productId: product.id,
          guaranteedCapacity: 10,
          maxCapacity: 20,
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.guaranteedCapacity).toBe(10)
      expect(body.data.maxCapacity).toBe(20)
      expect(body.data.active).toBe(true)
    })

    it("lists inventory allotments", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      await ctx.seedInventoryAllotment(channel.id, product.id)
      const res = await ctx.app.request("/inventory-allotments", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets an inventory allotment by id", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const res = await ctx.app.request(`/inventory-allotments/${allotment.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(allotment.id)
    })

    it("updates an inventory allotment", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const res = await ctx.app.request(`/inventory-allotments/${allotment.id}`, {
        method: "PATCH",
        ...json({ guaranteedCapacity: 50 }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.guaranteedCapacity).toBe(50)
    })

    it("deletes an inventory allotment", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const res = await ctx.app.request(`/inventory-allotments/${allotment.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent inventory allotment", async () => {
      const res = await ctx.app.request("/inventory-allotments/chia_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Inventory Allotment Targets CRUD", () => {
    it("creates an allotment target", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const res = await ctx.app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({
          allotmentId: allotment.id,
          dateLocal: "2025-06-15",
          guaranteedCapacity: 5,
          maxCapacity: 10,
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.dateLocal).toBe("2025-06-15")
      expect(body.data.guaranteedCapacity).toBe(5)
    })

    it("lists allotment targets", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      await ctx.app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id, dateLocal: "2025-07-01" }),
      })
      const res = await ctx.app.request("/inventory-allotment-targets", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets an allotment target by id", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const createRes = await ctx.app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const target = (await createRes.json()).data
      const res = await ctx.app.request(`/inventory-allotment-targets/${target.id}`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(target.id)
    })

    it("updates an allotment target", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const createRes = await ctx.app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const target = (await createRes.json()).data
      const res = await ctx.app.request(`/inventory-allotment-targets/${target.id}`, {
        method: "PATCH",
        ...json({ soldCapacity: 3, remainingCapacity: 7 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.soldCapacity).toBe(3)
      expect(body.data.remainingCapacity).toBe(7)
    })

    it("deletes an allotment target", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const createRes = await ctx.app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const target = (await createRes.json()).data
      const res = await ctx.app.request(`/inventory-allotment-targets/${target.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent allotment target", async () => {
      const res = await ctx.app.request(
        "/inventory-allotment-targets/chat_00000000000000000000000000",
        { method: "GET" },
      )
      expect(res.status).toBe(404)
    })
  })

  describe("Inventory Release Rules CRUD", () => {
    it("creates a release rule", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const res = await ctx.app.request("/inventory-release-rules", {
        method: "POST",
        ...json({
          allotmentId: allotment.id,
          releaseMode: "automatic",
          releaseDaysBeforeStart: 3,
          unsoldAction: "release_to_general_pool",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.releaseMode).toBe("automatic")
      expect(body.data.releaseDaysBeforeStart).toBe(3)
    })

    it("lists release rules", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      await ctx.seedReleaseRule(allotment.id)
      const res = await ctx.app.request("/inventory-release-rules", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a release rule by id", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      const res = await ctx.app.request(`/inventory-release-rules/${rule.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(rule.id)
    })

    it("updates a release rule", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      const res = await ctx.app.request(`/inventory-release-rules/${rule.id}`, {
        method: "PATCH",
        ...json({ releaseMode: "manual" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.releaseMode).toBe("manual")
    })

    it("deletes a release rule", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const allotment = await ctx.seedInventoryAllotment(channel.id, product.id)
      const rule = await ctx.seedReleaseRule(allotment.id)
      const res = await ctx.app.request(`/inventory-release-rules/${rule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent release rule", async () => {
      const res = await ctx.app.request(
        "/inventory-release-rules/chrr_00000000000000000000000000",
        {
          method: "GET",
        },
      )
      expect(res.status).toBe(404)
    })
  })

  // ─── Settlement Runs ──────────────────────────────────────
})
