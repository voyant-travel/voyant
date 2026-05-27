import { describe, expect, it } from "vitest"

import { createExtrasTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Product Extras routes", () => {
  const ctx = createExtrasTestContext()

  describe("Product Extras", () => {
    it("creates a product extra with defaults", async () => {
      const extra = await ctx.seedProductExtra()
      expect(extra.id).toMatch(/^pxtr_/)
      expect(extra.selectionType).toBe("optional")
      expect(extra.pricingMode).toBe("per_booking")
      expect(extra.collectionMode).toBe("booking_total")
      expect(extra.showOnSlotManifest).toBe(true)
      expect(extra.active).toBe(true)
      expect(extra.sortOrder).toBe(0)
    })

    it("creates a product extra with all fields", async () => {
      const extra = await ctx.seedProductExtra({
        code: "LUNCH",
        description: "Packed lunch",
        selectionType: "required",
        pricingMode: "per_person",
        pricedPerPerson: true,
        collectionMode: "cash_on_trip",
        showOnSlotManifest: false,
        minQuantity: 1,
        maxQuantity: 10,
        defaultQuantity: 2,
        sortOrder: 5,
        metadata: { category: "food" },
      })
      expect(extra.code).toBe("LUNCH")
      expect(extra.description).toBe("Packed lunch")
      expect(extra.selectionType).toBe("required")
      expect(extra.pricingMode).toBe("per_person")
      expect(extra.pricedPerPerson).toBe(true)
      expect(extra.collectionMode).toBe("cash_on_trip")
      expect(extra.showOnSlotManifest).toBe(false)
      expect(extra.minQuantity).toBe(1)
      expect(extra.maxQuantity).toBe(10)
      expect(extra.defaultQuantity).toBe(2)
      expect(extra.sortOrder).toBe(5)
      expect(extra.metadata).toEqual({ category: "food" })
    })

    it("gets a product extra by id", async () => {
      const extra = await ctx.seedProductExtra()
      const res = await ctx.request(`/product-extras/${extra.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(extra.id)
    })

    it("returns 404 for non-existent product extra", async () => {
      const res = await ctx.request("/product-extras/pxtr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a product extra", async () => {
      const extra = await ctx.seedProductExtra()
      const res = await ctx.request(`/product-extras/${extra.id}`, {
        method: "PATCH",
        ...json({ name: "Updated Name", active: false }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.name).toBe("Updated Name")
      expect(data.active).toBe(false)
    })

    it("returns 404 when updating non-existent product extra", async () => {
      const res = await ctx.request("/product-extras/pxtr_00000000000000000000000000", {
        method: "PATCH",
        ...json({ name: "x" }),
      })
      expect(res.status).toBe(404)
    })

    it("deletes a product extra", async () => {
      const extra = await ctx.seedProductExtra()
      const res = await ctx.request(`/product-extras/${extra.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      const check = await ctx.request(`/product-extras/${extra.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })

    it("returns 404 when deleting non-existent product extra", async () => {
      const res = await ctx.request("/product-extras/pxtr_00000000000000000000000000", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Product Extras list & filters", () => {
    it("lists product extras with pagination", async () => {
      const product = await ctx.seedProduct()
      await ctx.seedProductExtra({ productId: product.id })
      await ctx.seedProductExtra({ productId: product.id })
      await ctx.seedProductExtra({ productId: product.id })

      const res = await ctx.request("/product-extras?limit=2&offset=0", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by productId", async () => {
      const p1 = await ctx.seedProduct()
      const p2 = await ctx.seedProduct()
      await ctx.seedProductExtra({ productId: p1.id })
      await ctx.seedProductExtra({ productId: p2.id })

      const res = await ctx.request(`/product-extras?productId=${p1.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].productId).toBe(p1.id)
    })

    it("filters by active", async () => {
      const product = await ctx.seedProduct()
      await ctx.seedProductExtra({ productId: product.id, active: true })
      await ctx.seedProductExtra({ productId: product.id, active: false })

      const res = await ctx.request(`/product-extras?productId=${product.id}&active=false`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].active).toBe(false)
    })

    it("searches by name", async () => {
      const product = await ctx.seedProduct()
      await ctx.seedProductExtra({ productId: product.id, name: "Airport Transfer" })
      await ctx.seedProductExtra({ productId: product.id, name: "Lunch Pack" })

      const res = await ctx.request("/product-extras?search=Airport", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].name).toBe("Airport Transfer")
    })

    it("searches by code", async () => {
      const product = await ctx.seedProduct()
      await ctx.seedProductExtra({ productId: product.id, code: "XFER" })
      await ctx.seedProductExtra({ productId: product.id, code: "MEAL" })

      const res = await ctx.request("/product-extras?search=XFER", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
    })
  })
})
