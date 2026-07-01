import { describe, expect, it } from "vitest"

import { DB_AVAILABLE, json, setupDistributionRoutes } from "./routes.setup.js"

describe.skipIf(!DB_AVAILABLE)("Distribution commercial routes", () => {
  const ctx = setupDistributionRoutes()

  describe("Contracts CRUD", () => {
    it("creates a contract", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/contracts", {
        method: "POST",
        ...json({ channelId: channel.id, startsAt: "2025-01-01" }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.id).toBeTruthy()
      expect(body.data.status).toBe("draft")
      expect(body.data.paymentOwner).toBe("operator")
    })

    it("lists contracts", async () => {
      const channel = await ctx.seedChannel()
      await ctx.seedContract(channel.id)
      const res = await ctx.app.request("/contracts", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBeGreaterThanOrEqual(1)
    })

    it("filters contracts by channelId", async () => {
      const ch1 = await ctx.seedChannel()
      const ch2 = await ctx.seedChannel()
      await ctx.seedContract(ch1.id)
      await ctx.seedContract(ch2.id)
      const res = await ctx.app.request(`/contracts?channelId=${ch1.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.data.every((c: Record<string, unknown>) => c.channelId === ch1.id)).toBe(true)
    })

    it("gets a contract by id", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      const res = await ctx.app.request(`/contracts/${contract.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(contract.id)
    })

    it("updates a contract", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      const res = await ctx.app.request(`/contracts/${contract.id}`, {
        method: "PATCH",
        ...json({ status: "active", notes: "Updated" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("active")
      expect(body.data.notes).toBe("Updated")
    })

    it("deletes a contract", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      const res = await ctx.app.request(`/contracts/${contract.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent contract", async () => {
      const res = await ctx.app.request("/contracts/chco_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Contracts batch operations", () => {
    it("batch-updates contracts", async () => {
      const channel = await ctx.seedChannel()
      const c1 = await ctx.seedContract(channel.id)
      const c2 = await ctx.seedContract(channel.id)
      const res = await ctx.app.request("/contracts/batch-update", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id], patch: { status: "active" } }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).succeeded).toBe(2)
    })

    it("batch-deletes contracts", async () => {
      const channel = await ctx.seedChannel()
      const c1 = await ctx.seedContract(channel.id)
      const c2 = await ctx.seedContract(channel.id)
      const res = await ctx.app.request("/contracts/batch-delete", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id] }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).succeeded).toBe(2)
    })
  })

  describe("Commission Rules CRUD", () => {
    it("creates a commission rule", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      const res = await ctx.app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "percentage",
          percentBasisPoints: 1000,
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.scope).toBe("booking")
      expect(body.data.commissionType).toBe("percentage")
      expect(body.data.percentBasisPoints).toBe(1000)
    })

    it("lists commission rules", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      await ctx.app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "product",
          commissionType: "fixed",
          amountCents: 500,
        }),
      })
      const res = await ctx.app.request("/commission-rules", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters commission rules by scope", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      await ctx.app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      await ctx.app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "rate",
          commissionType: "fixed",
          amountCents: 200,
        }),
      })
      const res = await ctx.app.request("/commission-rules?scope=booking", { method: "GET" })
      const body = await res.json()
      expect(body.data.every((r: Record<string, unknown>) => r.scope === "booking")).toBe(true)
    })

    it("gets a commission rule by id", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      const createRes = await ctx.app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      const rule = (await createRes.json()).data
      const res = await ctx.app.request(`/commission-rules/${rule.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(rule.id)
    })

    it("updates a commission rule", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      const createRes = await ctx.app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      const rule = (await createRes.json()).data
      const res = await ctx.app.request(`/commission-rules/${rule.id}`, {
        method: "PATCH",
        ...json({ amountCents: 200 }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.amountCents).toBe(200)
    })

    it("deletes a commission rule", async () => {
      const channel = await ctx.seedChannel()
      const contract = await ctx.seedContract(channel.id)
      const createRes = await ctx.app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      const rule = (await createRes.json()).data
      const res = await ctx.app.request(`/commission-rules/${rule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent commission rule", async () => {
      const res = await ctx.app.request("/commission-rules/chcr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Product Mappings CRUD", () => {
    it("creates a product mapping", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const res = await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({
          channelId: channel.id,
          productId: product.id,
          externalProductId: "EXT-001",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.externalProductId).toBe("EXT-001")
      expect(body.data.active).toBe(true)
    })

    it("preserves channel-push source fields on product mappings", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const res = await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({
          channelId: channel.id,
          productId: product.id,
          externalProductId: "EXT-SOURCE-001",
          sourceKind: "demo",
          sourceConnectionId: "default:demo",
          pushBookings: true,
          pushAvailability: false,
          pushContent: true,
          policy: { compensation: "eventually-consistent" },
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toMatchObject({
        sourceKind: "demo",
        sourceConnectionId: "default:demo",
        pushBookings: true,
        pushAvailability: false,
        pushContent: true,
        policy: { compensation: "eventually-consistent" },
      })

      const readRes = await ctx.app.request(`/product-mappings/${body.data.id}`, { method: "GET" })
      expect(readRes.status).toBe(200)
      expect((await readRes.json()).data).toMatchObject({
        sourceKind: "demo",
        sourceConnectionId: "default:demo",
        pushAvailability: false,
        policy: { compensation: "eventually-consistent" },
      })
    })

    it("allows product mappings for unmanaged external product ids", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({
          channelId: channel.id,
          productId: "prod_missing",
          externalProductId: "EXT-MISSING",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.productId).toBe("prod_missing")
    })

    it("lists product mappings", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-002" }),
      })
      const res = await ctx.app.request("/product-mappings", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters product mappings by channelId", async () => {
      const ch1 = await ctx.seedChannel()
      const ch2 = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: ch1.id, productId: product.id, externalProductId: "X1" }),
      })
      await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: ch2.id, productId: product.id, externalProductId: "X2" }),
      })
      const res = await ctx.app.request(`/product-mappings?channelId=${ch1.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.data.every((m: Record<string, unknown>) => m.channelId === ch1.id)).toBe(true)
    })

    it("gets a product mapping by id", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const createRes = await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-003" }),
      })
      const mapping = (await createRes.json()).data
      const res = await ctx.app.request(`/product-mappings/${mapping.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(mapping.id)
    })

    it("updates a product mapping", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const createRes = await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-004" }),
      })
      const mapping = (await createRes.json()).data
      const res = await ctx.app.request(`/product-mappings/${mapping.id}`, {
        method: "PATCH",
        ...json({ active: false }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.active).toBe(false)
    })

    it("updates channel-push source fields on product mappings", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const createRes = await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-004A" }),
      })
      const mapping = (await createRes.json()).data

      const res = await ctx.app.request(`/product-mappings/${mapping.id}`, {
        method: "PATCH",
        ...json({
          sourceKind: "demo",
          sourceConnectionId: "default:demo",
          pushBookings: false,
          policy: { fieldMask: ["bookingNumber"] },
        }),
      })

      expect(res.status).toBe(200)
      expect((await res.json()).data).toMatchObject({
        sourceKind: "demo",
        sourceConnectionId: "default:demo",
        pushBookings: false,
        policy: { fieldMask: ["bookingNumber"] },
      })
    })

    it("deletes a product mapping", async () => {
      const channel = await ctx.seedChannel()
      const product = await ctx.seedProduct()
      const createRes = await ctx.app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-005" }),
      })
      const mapping = (await createRes.json()).data
      const res = await ctx.app.request(`/product-mappings/${mapping.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent product mapping", async () => {
      const res = await ctx.app.request("/product-mappings/chpm_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Booking Links CRUD", () => {
    it("creates a booking link", async () => {
      const channel = await ctx.seedChannel()
      const booking = await ctx.seedBooking()
      const res = await ctx.app.request("/booking-links", {
        method: "POST",
        ...json({
          channelId: channel.id,
          bookingId: booking.id,
          externalBookingId: "EXT-BK-001",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.bookingId).toBe(booking.id)
      expect(body.data.externalBookingId).toBe("EXT-BK-001")
    })

    it("rejects booking links for unknown booking ids", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/booking-links", {
        method: "POST",
        ...json({
          channelId: channel.id,
          bookingId: "book_missing",
          externalBookingId: "EXT-BK-MISSING",
        }),
      })
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe("invalid_request")
    })

    it("returns 409 for duplicate booking links", async () => {
      const channel = await ctx.seedChannel()
      const booking = await ctx.seedBooking()
      const body = {
        channelId: channel.id,
        bookingId: booking.id,
        externalBookingId: "EXT-BK-DUP",
      }
      const first = await ctx.app.request("/booking-links", {
        method: "POST",
        ...json(body),
      })
      expect(first.status).toBe(201)

      const second = await ctx.app.request("/booking-links", {
        method: "POST",
        ...json(body),
      })
      expect(second.status).toBe(409)
      expect((await second.json()).code).toBe("duplicate_channel_booking_link")
    })

    it("lists booking links", async () => {
      const channel = await ctx.seedChannel()
      const booking = await ctx.seedBooking()
      await ctx.app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: booking.id }),
      })
      const res = await ctx.app.request("/booking-links", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a booking link by id", async () => {
      const channel = await ctx.seedChannel()
      const booking = await ctx.seedBooking()
      const createRes = await ctx.app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: booking.id }),
      })
      const link = (await createRes.json()).data
      const res = await ctx.app.request(`/booking-links/${link.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(link.id)
    })

    it("updates a booking link", async () => {
      const channel = await ctx.seedChannel()
      const booking = await ctx.seedBooking()
      const createRes = await ctx.app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: booking.id }),
      })
      const link = (await createRes.json()).data
      const res = await ctx.app.request(`/booking-links/${link.id}`, {
        method: "PATCH",
        ...json({ externalStatus: "confirmed" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.externalStatus).toBe("confirmed")
    })

    it("deletes a booking link", async () => {
      const channel = await ctx.seedChannel()
      const booking = await ctx.seedBooking()
      const createRes = await ctx.app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: booking.id }),
      })
      const link = (await createRes.json()).data
      const res = await ctx.app.request(`/booking-links/${link.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent booking link", async () => {
      const res = await ctx.app.request("/booking-links/chbl_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Webhook Events CRUD", () => {
    it("creates a webhook event", async () => {
      const channel = await ctx.seedChannel()
      const res = await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({
          channelId: channel.id,
          eventType: "booking.created",
          payload: { bookingId: "ext-123" },
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.eventType).toBe("booking.created")
      expect(body.data.status).toBe("pending")
    })

    it("rejects webhook events for unknown channel ids", async () => {
      const res = await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({
          channelId: "chan_missing",
          eventType: "booking.created",
          payload: { bookingId: "ext-123" },
        }),
      })
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe("invalid_request")
    })

    it("lists webhook events", async () => {
      const channel = await ctx.seedChannel()
      await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "booking.updated", payload: {} }),
      })
      const res = await ctx.app.request("/webhook-events", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters webhook events by status", async () => {
      const channel = await ctx.seedChannel()
      await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "a", payload: {}, status: "pending" }),
      })
      await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "b", payload: {}, status: "processed" }),
      })
      const res = await ctx.app.request("/webhook-events?status=pending", { method: "GET" })
      const body = await res.json()
      expect(body.data.every((e: Record<string, unknown>) => e.status === "pending")).toBe(true)
    })

    it("gets a webhook event by id", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "test", payload: {} }),
      })
      const event = (await createRes.json()).data
      const res = await ctx.app.request(`/webhook-events/${event.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(event.id)
    })

    it("updates a webhook event", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "test", payload: {} }),
      })
      const event = (await createRes.json()).data
      const res = await ctx.app.request(`/webhook-events/${event.id}`, {
        method: "PATCH",
        ...json({ status: "processed" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("processed")
    })

    it("deletes a webhook event", async () => {
      const channel = await ctx.seedChannel()
      const createRes = await ctx.app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "test", payload: {} }),
      })
      const event = (await createRes.json()).data
      const res = await ctx.app.request(`/webhook-events/${event.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent webhook event", async () => {
      const res = await ctx.app.request("/webhook-events/chwe_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Inventory Allotments ─────────────────────────────────
})
