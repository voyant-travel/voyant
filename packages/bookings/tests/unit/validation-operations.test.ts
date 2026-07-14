import { describe, expect, it } from "vitest"

import {
  cancelBookingSchema,
  confirmBookingSchema,
  convertProductSchema,
  expireBookingSchema,
  expireStaleBookingsSchema,
  extendBookingHoldSchema,
  insertBookingAllocationSchema,
  insertBookingFulfillmentSchema,
  recordBookingRedemptionSchema,
  reserveBookingSchema,
  updateBookingAllocationSchema,
  updateBookingFulfillmentSchema,
} from "../../src/validation.js"

describe("Reservation schemas", () => {
  it("parses explicit pax for product conversion", () => {
    const result = convertProductSchema.parse({
      productId: "prod_123",
      bookingNumber: "BK-CONVERT-001",
      pax: 3,
    })

    expect(result.pax).toBe(3)
  })

  it("parses reserve booking input with policy-resolved hold minutes", () => {
    const result = reserveBookingSchema.parse({
      bookingNumber: "BK-RES-001",
      sellCurrency: "USD",
      items: [
        {
          title: "Adult ticket",
          availabilitySlotId: "avs_123",
          sourceSnapshotId: "sels_123",
          sourceOfferId: "ofr_123",
        },
      ],
    })

    expect(result.holdMinutes).toBeUndefined()
    expect(result.sourceType).toBe("manual")
    expect(result.items[0]?.itemType).toBe("unit")
    expect(result.items[0]?.allocationType).toBe("unit")
    expect(result.items[0]?.sourceSnapshotId).toBe("sels_123")
    expect(result.items[0]?.sourceOfferId).toBe("ofr_123")
  })

  it("requires at least one reservation item", () => {
    expect(() =>
      reserveBookingSchema.parse({
        bookingNumber: "BK-RES-001",
        sellCurrency: "USD",
        items: [],
      }),
    ).toThrow()
  })

  it("requires a hold extension value", () => {
    expect(() => extendBookingHoldSchema.parse({})).toThrow()
    expect(extendBookingHoldSchema.parse({ holdMinutes: 15 }).holdMinutes).toBe(15)
  })

  it("accepts confirm, cancel, and expire payloads", () => {
    expect(confirmBookingSchema.parse({ note: "ok" }).note).toBe("ok")
    expect(cancelBookingSchema.parse({ note: "cancel" }).note).toBe("cancel")
    expect(expireBookingSchema.parse({ note: "expire" }).note).toBe("expire")
  })

  it("parses expire stale bookings payload", () => {
    const result = expireStaleBookingsSchema.parse({
      before: "2026-06-01T10:00:00.000Z",
      note: "sweep",
    })
    expect(result.before).toBe("2026-06-01T10:00:00.000Z")
    expect(result.note).toBe("sweep")
  })

  it("parses booking allocation input", () => {
    const result = insertBookingAllocationSchema.parse({
      bookingItemId: "bki_123",
      availabilitySlotId: "avs_123",
    })

    expect(result.quantity).toBe(1)
    expect(result.status).toBe("held")
  })

  it("accepts partial booking allocation updates", () => {
    const result = updateBookingAllocationSchema.parse({ status: "confirmed" })
    expect(result.status).toBe("confirmed")
  })
})

describe("Booking fulfillment schema", () => {
  it("accepts valid fulfillment input", () => {
    const result = insertBookingFulfillmentSchema.parse({
      travelerId: "bkpt_123",
      fulfillmentType: "service_voucher",
      deliveryChannel: "download",
      artifactUrl: "https://example.com/service-voucher.pdf",
    })

    expect(result.fulfillmentType).toBe("service_voucher")
    expect(result.deliveryChannel).toBe("download")
    expect(result.status).toBe("issued")
    expect(result.travelerId).toBe("bkpt_123")
  })

  it("rejects the legacy voucher fulfillment value", () => {
    expect(() =>
      insertBookingFulfillmentSchema.parse({
        fulfillmentType: "voucher",
        deliveryChannel: "download",
      }),
    ).toThrow()
  })

  it("rejects invalid artifact url", () => {
    expect(() =>
      insertBookingFulfillmentSchema.parse({
        fulfillmentType: "ticket",
        deliveryChannel: "email",
        artifactUrl: "not-a-url",
      }),
    ).toThrow()
  })

  it("accepts partial fulfillment update", () => {
    const result = updateBookingFulfillmentSchema.parse({ status: "revoked" })
    expect(result.status).toBe("revoked")
  })
})

describe("Booking redemption schema", () => {
  it("accepts valid redemption input", () => {
    const result = recordBookingRedemptionSchema.parse({
      travelerId: "bkpt_123",
      method: "scan",
      redeemedAt: "2026-06-01T10:00:00.000Z",
      metadata: { gate: "north" },
    })

    expect(result.method).toBe("scan")
    expect(result.redeemedAt).toBe("2026-06-01T10:00:00.000Z")
    expect(result.travelerId).toBe("bkpt_123")
  })

  it("defaults redemption method to manual", () => {
    const result = recordBookingRedemptionSchema.parse({})
    expect(result.method).toBe("manual")
  })
})
