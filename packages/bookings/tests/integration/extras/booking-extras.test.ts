import { describe, expect, it } from "vitest"

import { createExtrasTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Booking Extras routes", () => {
  const ctx = createExtrasTestContext()

  describe("Booking Extras", () => {
    it("creates a booking extra with defaults", async () => {
      const extra = await ctx.seedBookingExtra()
      expect(extra.id).toMatch(/^bkex_/)
      expect(extra.status).toBe("draft")
      expect(extra.pricingMode).toBe("per_booking")
      expect(extra.quantity).toBe(1)
    })

    it("creates a booking extra with all fields", async () => {
      const product = await ctx.seedProduct()
      const productExtra = await ctx.seedProductExtra({ productId: product.id })
      const booking = await ctx.seedBooking()

      const extra = await ctx.seedBookingExtra({
        bookingId: booking.id,
        productExtraId: productExtra.id,
        name: "Lunch",
        description: "Packed lunch for each person",
        status: "selected",
        pricingMode: "per_person",
        pricedPerPerson: true,
        quantity: 4,
        sellCurrency: "EUR",
        unitSellAmountCents: 1500,
        totalSellAmountCents: 6000,
        costCurrency: "EUR",
        unitCostAmountCents: 800,
        totalCostAmountCents: 3200,
        notes: "Vegetarian option",
        metadata: { dietary: "vegetarian" },
      })
      expect(extra.name).toBe("Lunch")
      expect(extra.status).toBe("selected")
      expect(extra.pricingMode).toBe("per_person")
      expect(extra.quantity).toBe(4)
      expect(extra.unitSellAmountCents).toBe(1500)
      expect(extra.totalSellAmountCents).toBe(6000)
      expect(extra.costCurrency).toBe("EUR")
      expect(extra.notes).toBe("Vegetarian option")
      expect(extra.metadata).toEqual({ dietary: "vegetarian" })
    })

    it("gets a booking extra by id", async () => {
      const extra = await ctx.seedBookingExtra()
      const res = await ctx.request(`/booking-extras/${extra.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(extra.id)
    })

    it("returns 404 for non-existent booking extra", async () => {
      const res = await ctx.request("/booking-extras/bkex_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a booking extra", async () => {
      const extra = await ctx.seedBookingExtra()
      const res = await ctx.request(`/booking-extras/${extra.id}`, {
        method: "PATCH",
        ...json({ status: "confirmed", quantity: 3 }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.status).toBe("confirmed")
      expect(data.quantity).toBe(3)
    })

    it("returns 404 when updating non-existent booking extra", async () => {
      const res = await ctx.request("/booking-extras/bkex_00000000000000000000000000", {
        method: "PATCH",
        ...json({ status: "confirmed" }),
      })
      expect(res.status).toBe(404)
    })

    it("deletes a booking extra", async () => {
      const extra = await ctx.seedBookingExtra()
      const res = await ctx.request(`/booking-extras/${extra.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await ctx.request(`/booking-extras/${extra.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })

    it("returns 404 when deleting non-existent booking extra", async () => {
      const res = await ctx.request("/booking-extras/bkex_00000000000000000000000000", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Booking Extras list & filters", () => {
    it("lists with pagination", async () => {
      const booking = await ctx.seedBooking()
      await ctx.seedBookingExtra({ bookingId: booking.id })
      await ctx.seedBookingExtra({ bookingId: booking.id })
      await ctx.seedBookingExtra({ bookingId: booking.id })

      const res = await ctx.request("/booking-extras?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by bookingId", async () => {
      const b1 = await ctx.seedBooking()
      const b2 = await ctx.seedBooking()
      await ctx.seedBookingExtra({ bookingId: b1.id })
      await ctx.seedBookingExtra({ bookingId: b2.id })

      const res = await ctx.request(`/booking-extras?bookingId=${b1.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
    })

    it("filters by status", async () => {
      const booking = await ctx.seedBooking()
      await ctx.seedBookingExtra({ bookingId: booking.id, status: "draft" })
      await ctx.seedBookingExtra({ bookingId: booking.id, status: "confirmed" })

      const res = await ctx.request("/booking-extras?status=confirmed", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].status).toBe("confirmed")
    })

    it("filters by productExtraId", async () => {
      const product = await ctx.seedProduct()
      const productExtra = await ctx.seedProductExtra({ productId: product.id })
      const booking = await ctx.seedBooking()
      await ctx.seedBookingExtra({ bookingId: booking.id, productExtraId: productExtra.id })
      await ctx.seedBookingExtra({ bookingId: booking.id })

      const res = await ctx.request(`/booking-extras?productExtraId=${productExtra.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(1)
    })
  })
})
