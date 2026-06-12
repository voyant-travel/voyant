import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { octoRoutes } from "../../src/routes.js"
import { bookingTransactionDetailsRef } from "../../src/transactions-ref.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0
function nextSeq(prefix: string) {
  seq++
  return `${prefix}-${String(seq).padStart(4, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("OCTO routes (integration)", () => {
  let app: Hono
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: octo; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", octoRoutes)
  })

  beforeEach(async () => {
    seq = 0
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedProjectedProduct() {
    const { optionUnits, productCapabilities, productFeatures, productOptions, products } =
      await import("@voyantjs/products/schema")
    const { availabilityStartTimes, availabilitySlots } = await import(
      "@voyantjs/availability/schema"
    )

    const [product] = await db
      .insert(products)
      .values({
        name: "Bucharest Food Tour",
        status: "active",
        description: "Tasting walk",
        bookingMode: "date_time",
        capacityMode: "limited",
        timezone: "Europe/Bucharest",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    const [option] = await db
      .insert(productOptions)
      .values({
        productId: product.id,
        name: "Morning departure",
        code: "AM",
        status: "active",
        isDefault: true,
      })
      .returning()

    await db.insert(optionUnits).values({
      optionId: option.id,
      name: "Adult ticket",
      code: "adult",
      unitType: "person",
      minAge: 18,
    })

    await db.insert(productCapabilities).values({
      productId: product.id,
      capability: "instant_confirmation",
      enabled: true,
    })

    await db.insert(productFeatures).values({
      productId: product.id,
      featureType: "inclusion",
      title: "Local tastings",
    })

    await db.insert(availabilityStartTimes).values({
      productId: product.id,
      optionId: option.id,
      startTimeLocal: "09:00",
    })

    await db.insert(availabilitySlots).values([
      {
        productId: product.id,
        optionId: option.id,
        dateLocal: "2026-08-01",
        startsAt: new Date("2026-08-01T06:00:00Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        initialPax: 10,
        remainingPax: 8,
      },
      {
        productId: product.id,
        optionId: option.id,
        dateLocal: "2026-08-01",
        startsAt: new Date("2026-08-01T12:00:00Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        initialPax: 10,
        remainingPax: 3,
      },
    ])

    return { product, option }
  }

  async function seedBookingProjectionData() {
    const { availabilitySlots } = await import("@voyantjs/availability/schema")
    const { bookingFulfillments, bookingSupplierStatuses, bookings } = await import(
      "@voyantjs/bookings/schema"
    )
    const { offers, orders } = await import("@voyantjs/transactions/schema")

    const [slot] = await db
      .insert(availabilitySlots)
      .values({
        productId: "prod_test",
        optionId: "opt_test",
        dateLocal: "2026-09-10",
        startsAt: new Date("2026-09-10T09:00:00Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        initialPax: 12,
        remainingPax: 12,
      })
      .returning()

    const reserveRes = await app.request("/bookings", {
      method: "POST",
      ...json({
        bookingNumber: nextSeq("BK"),
        sourceType: "reseller",
        externalBookingRef: "OTA-REF-42",
        sellCurrency: "EUR",
        items: [
          {
            title: "Tour admission",
            quantity: 2,
            availabilitySlotId: slot.id,
          },
        ],
      }),
    })

    expect(reserveRes.status).toBe(201)
    const reserveBody = await reserveRes.json()
    const bookingId = reserveBody.data.id

    const [offer] = await db
      .insert(offers)
      .values({
        offerNumber: nextSeq("OFF"),
        title: "Offer",
        status: "converted",
        currency: "EUR",
        totalAmountCents: 2000,
        costAmountCents: 1000,
      })
      .returning()

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber: nextSeq("ORD"),
        offerId: offer.id,
        title: "Order",
        status: "pending",
        currency: "EUR",
        totalAmountCents: 2000,
        costAmountCents: 1000,
      })
      .returning()

    await db.insert(bookingTransactionDetailsRef).values({
      bookingId,
      offerId: offer.id,
      orderId: order.id,
    })

    await db.insert(bookingSupplierStatuses).values({
      bookingId,
      serviceName: "Walking tour supplier",
      status: "confirmed",
      supplierReference: "SUP-77",
      costCurrency: "EUR",
      costAmountCents: 1000,
      confirmedAt: new Date("2026-04-07T10:00:00Z"),
    })

    const [bookingRow] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)

    const [item] = reserveBody.data.unitItems

    await db.insert(bookingFulfillments).values({
      bookingId,
      bookingItemId: item.bookingItemId,
      fulfillmentType: "qr_code",
      deliveryChannel: "download",
      status: "issued",
      artifactUrl: "https://example.com/ticket.pdf",
      payload: {
        qrCode: "qr-value",
        voucherCode: "VOUCH-99",
      },
      issuedAt: new Date("2026-04-07T10:00:00Z"),
    })

    return { booking: bookingRow, bookingId }
  }

  it("GET /products returns projected products", async () => {
    const { product } = await seedProjectedProduct()

    const res = await app.request("/products?status=active")
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(product.id)
    expect(body.data[0].extensions.status).toBe("active")
    expect(body.data[0].options[0].availabilityLocalStartTimes).toEqual(["09:00"])
  })

  it("GET /products/:id/calendar aggregates daily availability", async () => {
    const { product } = await seedProjectedProduct()

    const res = await app.request(
      `/products/${product.id}/calendar?localDateStart=2026-08-01&localDateEnd=2026-08-02`,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].localDate).toBe("2026-08-01")
    expect(body.data[0].status).toBe("AVAILABLE")
    expect(body.data[0].availabilityIds).toHaveLength(2)
  })

  it("GET /bookings/:id returns references and artifacts", async () => {
    const { bookingId } = await seedBookingProjectionData()

    const res = await app.request(`/bookings/${bookingId}`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.references.resellerReference).toBe("OTA-REF-42")
    expect(body.data.references.offerNumber).toMatch(/^OFF-/)
    expect(body.data.references.orderNumber).toMatch(/^ORD-/)
    expect(body.data.references.supplierReferences[0].supplierReference).toBe("SUP-77")
    expect(body.data.artifacts[0].qrCode).toBe("qr-value")
    expect(body.data.artifacts[0].voucherCode).toBe("VOUCH-99")
    expect(body.data.artifacts[0].downloadUrl).toBe("https://example.com/ticket.pdf")
  })

  it("POST /bookings/:id/redeem records redemption and returns updated booking", async () => {
    const { bookingId } = await seedBookingProjectionData()

    const redeemRes = await app.request(`/bookings/${bookingId}/redeem`, {
      method: "POST",
      ...json({
        redeemedBy: "gate-agent",
        location: "Main gate",
        method: "scan",
      }),
    })

    expect(redeemRes.status).toBe(201)
    const redeemBody = await redeemRes.json()
    expect(redeemBody.data.method).toBe("scan")
    expect(redeemBody.booking.redemptions).toHaveLength(1)
    expect(redeemBody.booking.redemptions[0].location).toBe("Main gate")

    const listRes = await app.request(`/bookings/${bookingId}/redemptions`)
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.data).toHaveLength(1)
    expect(listBody.data[0].redeemedBy).toBe("gate-agent")
  })
})
