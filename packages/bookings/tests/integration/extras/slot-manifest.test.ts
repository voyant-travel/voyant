import { describe, expect, it } from "vitest"

import { createExtrasTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Slot extras manifest routes", () => {
  const ctx = createExtrasTestContext()

  it("returns a traveler-by-extra manifest for a slot", async () => {
    const product = await ctx.seedProduct()
    const slot = await ctx.seedAvailabilitySlot(product.id)
    const { traveler } = await ctx.seedBookingTravelerOnSlot(slot.id)
    const extra = await ctx.seedProductExtra({
      productId: product.id,
      name: "Bosfor cruise",
      collectionMode: "cash_on_trip",
    })

    const res = await ctx.request(`/slot-manifests/${slot.id}`, { method: "GET" })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.slot.id).toBe(slot.id)
    expect(data.extras).toHaveLength(1)
    expect(data.travelers).toHaveLength(1)
    expect(data.travelers[0].id).toBe(traveler.id)
    expect(data.selections).toHaveLength(1)
    expect(data.selections[0]).toMatchObject({
      travelerId: traveler.id,
      productExtraId: extra.id,
      selected: false,
      collectionMode: "cash_on_trip",
      collectionStatus: "pending",
      source: "empty",
    })
  })

  it("updates a cash-on-trip selection without requiring a booking item", async () => {
    const product = await ctx.seedProduct()
    const slot = await ctx.seedAvailabilitySlot(product.id)
    const { booking, traveler } = await ctx.seedBookingTravelerOnSlot(slot.id)
    const extra = await ctx.seedProductExtra({
      productId: product.id,
      name: "Bosfor cruise",
      collectionMode: "cash_on_trip",
    })

    const update = await ctx.request(`/slot-manifests/${slot.id}/selections`, {
      method: "PATCH",
      ...json({
        bookingId: booking.id,
        travelerId: traveler.id,
        productExtraId: extra.id,
        status: "selected",
      }),
    })
    expect(update.status).toBe(200)

    const res = await ctx.request(`/slot-manifests/${slot.id}`, { method: "GET" })
    const { data } = await res.json()
    expect(data.selections[0]).toMatchObject({
      travelerId: traveler.id,
      productExtraId: extra.id,
      selected: true,
      collectionStatus: "pending",
      source: "selection",
    })
  })

  it("bulk marks selected travelers as collected", async () => {
    const product = await ctx.seedProduct()
    const slot = await ctx.seedAvailabilitySlot(product.id)
    const { booking, traveler } = await ctx.seedBookingTravelerOnSlot(slot.id)
    const extra = await ctx.seedProductExtra({
      productId: product.id,
      name: "Bosfor cruise",
      collectionMode: "cash_on_trip",
    })

    await ctx.request(`/slot-manifests/${slot.id}/selections`, {
      method: "PATCH",
      ...json({
        bookingId: booking.id,
        travelerId: traveler.id,
        productExtraId: extra.id,
        status: "selected",
      }),
    })

    const collected = await ctx.request(`/slot-manifests/${slot.id}/collections/bulk`, {
      method: "POST",
      ...json({
        productExtraId: extra.id,
        travelerIds: [traveler.id],
        collectionStatus: "collected",
      }),
    })
    expect(collected.status).toBe(200)

    const res = await ctx.request(`/slot-manifests/${slot.id}`, { method: "GET" })
    const { data } = await res.json()
    expect(data.selections[0].collectionStatus).toBe("collected")
    expect(data.selections[0].collectedBy).toBe("test-user-id")
    expect(data.selections[0].collectedAt).toEqual(expect.any(String))
  })

  it("creates a booking item link for booking-total selections", async () => {
    const product = await ctx.seedProduct()
    const slot = await ctx.seedAvailabilitySlot(product.id)
    const { booking, traveler } = await ctx.seedBookingTravelerOnSlot(slot.id)
    const extra = await ctx.seedProductExtra({
      productId: product.id,
      name: "Paid dinner",
      collectionMode: "booking_total",
    })

    const update = await ctx.request(`/slot-manifests/${slot.id}/selections`, {
      method: "PATCH",
      ...json({
        bookingId: booking.id,
        travelerId: traveler.id,
        productExtraId: extra.id,
        status: "selected",
        collectionCurrency: "EUR",
        collectionAmountCents: 5000,
      }),
    })
    expect(update.status).toBe(200)

    const res = await ctx.request(`/slot-manifests/${slot.id}`, { method: "GET" })
    const { data } = await res.json()
    expect(data.selections[0]).toMatchObject({
      travelerId: traveler.id,
      productExtraId: extra.id,
      selected: true,
      bookingItemId: expect.stringMatching(/^bkit_/),
      collectionStatus: "not_required",
      collectionAmountCents: 5000,
    })
  })
})
