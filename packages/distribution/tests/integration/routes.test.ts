// agent-quality: file-size exception -- owner: distribution; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { distributionRoutes } from "../../src/routes.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let channelSeq = 0
function nextChannelName() {
  channelSeq++
  return `Channel-${String(channelSeq).padStart(4, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("Distribution routes", () => {
  let app: Hono
  let db: ReturnType<typeof import("@voyantjs/db/test-utils").createTestDb>

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
    app.route("/", distributionRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db as never)
  })

  async function seedChannel(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/channels", {
      method: "POST",
      ...json({ name: nextChannelName(), kind: "ota", ...overrides }),
    })
    return (await res.json()).data
  }

  async function seedContract(channelId: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request("/contracts", {
      method: "POST",
      ...json({ channelId, startsAt: "2025-01-01", ...overrides }),
    })
    return (await res.json()).data
  }

  async function seedProduct() {
    const { products } = await import("@voyantjs/products/schema")
    const [row] = await (db as never as import("drizzle-orm/postgres-js").PostgresJsDatabase)
      .insert(products)
      .values({ name: `Test Product ${Date.now()}`, sellCurrency: "USD" })
      .returning()
    return row!
  }

  async function seedSettlementRun(channelId: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request("/settlement-runs", {
      method: "POST",
      ...json({ channelId, ...overrides }),
    })
    return (await res.json()).data
  }

  async function seedReconciliationRun(channelId: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request("/reconciliation-runs", {
      method: "POST",
      ...json({ channelId, ...overrides }),
    })
    return (await res.json()).data
  }

  async function seedInventoryAllotment(
    channelId: string,
    productId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request("/inventory-allotments", {
      method: "POST",
      ...json({ channelId, productId, ...overrides }),
    })
    return (await res.json()).data
  }

  async function seedReleaseRule(allotmentId: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request("/inventory-release-rules", {
      method: "POST",
      ...json({ allotmentId, ...overrides }),
    })
    return (await res.json()).data
  }

  // ─── Channels ──────────────────────────────────────────────

  describe("Channels CRUD", () => {
    it("creates a channel", async () => {
      const res = await app.request("/channels", {
        method: "POST",
        ...json({ name: "Viator", kind: "ota" }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.id).toBeTruthy()
      expect(body.data.name).toBe("Viator")
      expect(body.data.kind).toBe("ota")
      expect(body.data.status).toBe("active")
    })

    it("creates a channel with identity fields", async () => {
      const res = await app.request("/channels", {
        method: "POST",
        ...json({
          name: "GetYourGuide",
          kind: "marketplace",
          website: "https://getyourguide.com",
          contactName: "John Doe",
          contactEmail: "john@gyg.com",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.website).toBe("https://getyourguide.com")
      expect(body.data.contactName).toBe("John Doe")
      expect(body.data.contactEmail).toBe("john@gyg.com")
    })

    it("lists channels", async () => {
      await seedChannel()
      const res = await app.request("/channels", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBeGreaterThanOrEqual(1)
    })

    it("lists channels filtered by kind", async () => {
      await seedChannel({ kind: "direct" })
      await seedChannel({ kind: "ota" })
      const res = await app.request("/channels?kind=direct", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.every((c: Record<string, unknown>) => c.kind === "direct")).toBe(true)
    })

    it("lists channels filtered by status", async () => {
      await seedChannel({ status: "inactive" })
      await seedChannel({ status: "active" })
      const res = await app.request("/channels?status=inactive", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.every((c: Record<string, unknown>) => c.status === "inactive")).toBe(true)
    })

    it("gets a channel by id", async () => {
      const channel = await seedChannel()
      const res = await app.request(`/channels/${channel.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(channel.id)
    })

    it("updates a channel", async () => {
      const channel = await seedChannel()
      const res = await app.request(`/channels/${channel.id}`, {
        method: "PATCH",
        ...json({ name: "Updated Channel" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.name).toBe("Updated Channel")
    })

    it("deletes a channel", async () => {
      const channel = await seedChannel()
      const res = await app.request(`/channels/${channel.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent channel", async () => {
      const res = await app.request("/channels/chan_00000000000000000000000000", { method: "GET" })
      expect(res.status).toBe(404)
    })
  })

  describe("Channel batch operations", () => {
    it("batch-updates channels", async () => {
      const c1 = await seedChannel()
      const c2 = await seedChannel()
      const res = await app.request("/channels/batch-update", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id], patch: { status: "inactive" } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("batch-deletes channels", async () => {
      const c1 = await seedChannel()
      const c2 = await seedChannel()
      const res = await app.request("/channels/batch-delete", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("reports failures for non-existent ids in batch-delete", async () => {
      const c1 = await seedChannel()
      const res = await app.request("/channels/batch-delete", {
        method: "POST",
        ...json({ ids: [c1.id, "chan_00000000000000000000000000"] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(1)
      expect(body.failed.length).toBe(1)
    })
  })

  // ─── Channel Contact Points (identity) ────────────────────

  describe("Channel Contact Points", () => {
    it("lists contact points for a channel", async () => {
      const channel = await seedChannel({ website: "https://example.com" })
      const res = await app.request(`/channels/${channel.id}/contact-points`, { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
    })

    it("creates a contact point for a channel", async () => {
      const channel = await seedChannel()
      const res = await app.request(`/channels/${channel.id}/contact-points`, {
        method: "POST",
        ...json({ kind: "email", label: "support", value: "support@channel.com" }),
      })
      expect(res.status).toBe(201)
      expect((await res.json()).data.value).toBe("support@channel.com")
    })

    it("returns 404 for contact points on non-existent channel", async () => {
      const res = await app.request("/channels/chan_00000000000000000000000000/contact-points", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Channel Named Contacts (identity) ────────────────────

  describe("Channel Named Contacts", () => {
    it("lists named contacts for a channel", async () => {
      const channel = await seedChannel()
      const res = await app.request(`/channels/${channel.id}/contacts`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data).toBeInstanceOf(Array)
    })

    it("creates a named contact for a channel", async () => {
      const channel = await seedChannel()
      const res = await app.request(`/channels/${channel.id}/contacts`, {
        method: "POST",
        ...json({ name: "Jane Smith", role: "sales", email: "jane@channel.com" }),
      })
      expect(res.status).toBe(201)
      expect((await res.json()).data.name).toBe("Jane Smith")
    })

    it("returns 404 for contacts on non-existent channel", async () => {
      const res = await app.request("/channels/chan_00000000000000000000000000/contacts", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Contracts ─────────────────────────────────────────────

  describe("Contracts CRUD", () => {
    it("creates a contract", async () => {
      const channel = await seedChannel()
      const res = await app.request("/contracts", {
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
      const channel = await seedChannel()
      await seedContract(channel.id)
      const res = await app.request("/contracts", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBeGreaterThanOrEqual(1)
    })

    it("filters contracts by channelId", async () => {
      const ch1 = await seedChannel()
      const ch2 = await seedChannel()
      await seedContract(ch1.id)
      await seedContract(ch2.id)
      const res = await app.request(`/contracts?channelId=${ch1.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.data.every((c: Record<string, unknown>) => c.channelId === ch1.id)).toBe(true)
    })

    it("gets a contract by id", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      const res = await app.request(`/contracts/${contract.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(contract.id)
    })

    it("updates a contract", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      const res = await app.request(`/contracts/${contract.id}`, {
        method: "PATCH",
        ...json({ status: "active", notes: "Updated" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("active")
      expect(body.data.notes).toBe("Updated")
    })

    it("deletes a contract", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      const res = await app.request(`/contracts/${contract.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent contract", async () => {
      const res = await app.request("/contracts/chco_00000000000000000000000000", { method: "GET" })
      expect(res.status).toBe(404)
    })
  })

  describe("Contracts batch operations", () => {
    it("batch-updates contracts", async () => {
      const channel = await seedChannel()
      const c1 = await seedContract(channel.id)
      const c2 = await seedContract(channel.id)
      const res = await app.request("/contracts/batch-update", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id], patch: { status: "active" } }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).succeeded).toBe(2)
    })

    it("batch-deletes contracts", async () => {
      const channel = await seedChannel()
      const c1 = await seedContract(channel.id)
      const c2 = await seedContract(channel.id)
      const res = await app.request("/contracts/batch-delete", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id] }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).succeeded).toBe(2)
    })
  })

  // ─── Commission Rules ─────────────────────────────────────

  describe("Commission Rules CRUD", () => {
    it("creates a commission rule", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      const res = await app.request("/commission-rules", {
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
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      await app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "product",
          commissionType: "fixed",
          amountCents: 500,
        }),
      })
      const res = await app.request("/commission-rules", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters commission rules by scope", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      await app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      await app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "rate",
          commissionType: "fixed",
          amountCents: 200,
        }),
      })
      const res = await app.request("/commission-rules?scope=booking", { method: "GET" })
      const body = await res.json()
      expect(body.data.every((r: Record<string, unknown>) => r.scope === "booking")).toBe(true)
    })

    it("gets a commission rule by id", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      const createRes = await app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      const rule = (await createRes.json()).data
      const res = await app.request(`/commission-rules/${rule.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(rule.id)
    })

    it("updates a commission rule", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      const createRes = await app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      const rule = (await createRes.json()).data
      const res = await app.request(`/commission-rules/${rule.id}`, {
        method: "PATCH",
        ...json({ amountCents: 200 }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.amountCents).toBe(200)
    })

    it("deletes a commission rule", async () => {
      const channel = await seedChannel()
      const contract = await seedContract(channel.id)
      const createRes = await app.request("/commission-rules", {
        method: "POST",
        ...json({
          contractId: contract.id,
          scope: "booking",
          commissionType: "fixed",
          amountCents: 100,
        }),
      })
      const rule = (await createRes.json()).data
      const res = await app.request(`/commission-rules/${rule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent commission rule", async () => {
      const res = await app.request("/commission-rules/chcr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Product Mappings ─────────────────────────────────────

  describe("Product Mappings CRUD", () => {
    it("creates a product mapping", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const res = await app.request("/product-mappings", {
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

    it("lists product mappings", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      await app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-002" }),
      })
      const res = await app.request("/product-mappings", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters product mappings by channelId", async () => {
      const ch1 = await seedChannel()
      const ch2 = await seedChannel()
      const product = await seedProduct()
      await app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: ch1.id, productId: product.id, externalProductId: "X1" }),
      })
      await app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: ch2.id, productId: product.id, externalProductId: "X2" }),
      })
      const res = await app.request(`/product-mappings?channelId=${ch1.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.data.every((m: Record<string, unknown>) => m.channelId === ch1.id)).toBe(true)
    })

    it("gets a product mapping by id", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const createRes = await app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-003" }),
      })
      const mapping = (await createRes.json()).data
      const res = await app.request(`/product-mappings/${mapping.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(mapping.id)
    })

    it("updates a product mapping", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const createRes = await app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-004" }),
      })
      const mapping = (await createRes.json()).data
      const res = await app.request(`/product-mappings/${mapping.id}`, {
        method: "PATCH",
        ...json({ active: false }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.active).toBe(false)
    })

    it("deletes a product mapping", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const createRes = await app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id, externalProductId: "EXT-005" }),
      })
      const mapping = (await createRes.json()).data
      const res = await app.request(`/product-mappings/${mapping.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent product mapping", async () => {
      const res = await app.request("/product-mappings/chpm_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Booking Links ────────────────────────────────────────

  describe("Booking Links CRUD", () => {
    it("creates a booking link", async () => {
      const channel = await seedChannel()
      const res = await app.request("/booking-links", {
        method: "POST",
        ...json({
          channelId: channel.id,
          bookingId: "book_test123",
          externalBookingId: "EXT-BK-001",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.bookingId).toBe("book_test123")
      expect(body.data.externalBookingId).toBe("EXT-BK-001")
    })

    it("lists booking links", async () => {
      const channel = await seedChannel()
      await app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: "book_test456" }),
      })
      const res = await app.request("/booking-links", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a booking link by id", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: "book_test789" }),
      })
      const link = (await createRes.json()).data
      const res = await app.request(`/booking-links/${link.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(link.id)
    })

    it("updates a booking link", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: "book_test_upd" }),
      })
      const link = (await createRes.json()).data
      const res = await app.request(`/booking-links/${link.id}`, {
        method: "PATCH",
        ...json({ externalStatus: "confirmed" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.externalStatus).toBe("confirmed")
    })

    it("deletes a booking link", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/booking-links", {
        method: "POST",
        ...json({ channelId: channel.id, bookingId: "book_test_del" }),
      })
      const link = (await createRes.json()).data
      const res = await app.request(`/booking-links/${link.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent booking link", async () => {
      const res = await app.request("/booking-links/chbl_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Webhook Events ───────────────────────────────────────

  describe("Webhook Events CRUD", () => {
    it("creates a webhook event", async () => {
      const channel = await seedChannel()
      const res = await app.request("/webhook-events", {
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

    it("lists webhook events", async () => {
      const channel = await seedChannel()
      await app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "booking.updated", payload: {} }),
      })
      const res = await app.request("/webhook-events", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters webhook events by status", async () => {
      const channel = await seedChannel()
      await app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "a", payload: {}, status: "pending" }),
      })
      await app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "b", payload: {}, status: "processed" }),
      })
      const res = await app.request("/webhook-events?status=pending", { method: "GET" })
      const body = await res.json()
      expect(body.data.every((e: Record<string, unknown>) => e.status === "pending")).toBe(true)
    })

    it("gets a webhook event by id", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "test", payload: {} }),
      })
      const event = (await createRes.json()).data
      const res = await app.request(`/webhook-events/${event.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(event.id)
    })

    it("updates a webhook event", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "test", payload: {} }),
      })
      const event = (await createRes.json()).data
      const res = await app.request(`/webhook-events/${event.id}`, {
        method: "PATCH",
        ...json({ status: "processed" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("processed")
    })

    it("deletes a webhook event", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/webhook-events", {
        method: "POST",
        ...json({ channelId: channel.id, eventType: "test", payload: {} }),
      })
      const event = (await createRes.json()).data
      const res = await app.request(`/webhook-events/${event.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent webhook event", async () => {
      const res = await app.request("/webhook-events/chwe_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Inventory Allotments ─────────────────────────────────

  describe("Inventory Allotments CRUD", () => {
    it("creates an inventory allotment", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const res = await app.request("/inventory-allotments", {
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
      const channel = await seedChannel()
      const product = await seedProduct()
      await seedInventoryAllotment(channel.id, product.id)
      const res = await app.request("/inventory-allotments", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets an inventory allotment by id", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const res = await app.request(`/inventory-allotments/${allotment.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(allotment.id)
    })

    it("updates an inventory allotment", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const res = await app.request(`/inventory-allotments/${allotment.id}`, {
        method: "PATCH",
        ...json({ guaranteedCapacity: 50 }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.guaranteedCapacity).toBe(50)
    })

    it("deletes an inventory allotment", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const res = await app.request(`/inventory-allotments/${allotment.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent inventory allotment", async () => {
      const res = await app.request("/inventory-allotments/chia_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Inventory Allotment Targets ──────────────────────────

  describe("Inventory Allotment Targets CRUD", () => {
    it("creates an allotment target", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const res = await app.request("/inventory-allotment-targets", {
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
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      await app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id, dateLocal: "2025-07-01" }),
      })
      const res = await app.request("/inventory-allotment-targets", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets an allotment target by id", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const createRes = await app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const target = (await createRes.json()).data
      const res = await app.request(`/inventory-allotment-targets/${target.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(target.id)
    })

    it("updates an allotment target", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const createRes = await app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const target = (await createRes.json()).data
      const res = await app.request(`/inventory-allotment-targets/${target.id}`, {
        method: "PATCH",
        ...json({ soldCapacity: 3, remainingCapacity: 7 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.soldCapacity).toBe(3)
      expect(body.data.remainingCapacity).toBe(7)
    })

    it("deletes an allotment target", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const createRes = await app.request("/inventory-allotment-targets", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const target = (await createRes.json()).data
      const res = await app.request(`/inventory-allotment-targets/${target.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent allotment target", async () => {
      const res = await app.request(
        "/inventory-allotment-targets/chat_00000000000000000000000000",
        { method: "GET" },
      )
      expect(res.status).toBe(404)
    })
  })

  // ─── Inventory Release Rules ──────────────────────────────

  describe("Inventory Release Rules CRUD", () => {
    it("creates a release rule", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const res = await app.request("/inventory-release-rules", {
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
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      await seedReleaseRule(allotment.id)
      const res = await app.request("/inventory-release-rules", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a release rule by id", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      const res = await app.request(`/inventory-release-rules/${rule.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(rule.id)
    })

    it("updates a release rule", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      const res = await app.request(`/inventory-release-rules/${rule.id}`, {
        method: "PATCH",
        ...json({ releaseMode: "manual" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.releaseMode).toBe("manual")
    })

    it("deletes a release rule", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      const res = await app.request(`/inventory-release-rules/${rule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent release rule", async () => {
      const res = await app.request("/inventory-release-rules/chrr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Settlement Runs ──────────────────────────────────────

  describe("Settlement Runs CRUD", () => {
    it("creates a settlement run", async () => {
      const channel = await seedChannel()
      const res = await app.request("/settlement-runs", {
        method: "POST",
        ...json({
          channelId: channel.id,
          currencyCode: "EUR",
          periodStart: "2025-01-01",
          periodEnd: "2025-01-31",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.status).toBe("draft")
      expect(body.data.currencyCode).toBe("EUR")
    })

    it("lists settlement runs", async () => {
      const channel = await seedChannel()
      await seedSettlementRun(channel.id)
      const res = await app.request("/settlement-runs", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a settlement run by id", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const res = await app.request(`/settlement-runs/${run.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(run.id)
    })

    it("updates a settlement run", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const res = await app.request(`/settlement-runs/${run.id}`, {
        method: "PATCH",
        ...json({ status: "open", statementReference: "STM-001" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("open")
      expect(body.data.statementReference).toBe("STM-001")
    })

    it("deletes a settlement run", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const res = await app.request(`/settlement-runs/${run.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement run", async () => {
      const res = await app.request("/settlement-runs/chsr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Settlement Items ─────────────────────────────────────

  describe("Settlement Items CRUD", () => {
    it("creates a settlement item", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const res = await app.request("/settlement-items", {
        method: "POST",
        ...json({
          settlementRunId: run.id,
          grossAmountCents: 10000,
          commissionAmountCents: 1500,
          netRemittanceAmountCents: 8500,
          currencyCode: "EUR",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.grossAmountCents).toBe(10000)
      expect(body.data.commissionAmountCents).toBe(1500)
      expect(body.data.netRemittanceAmountCents).toBe(8500)
      expect(body.data.status).toBe("pending")
    })

    it("lists settlement items", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      await app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const res = await app.request("/settlement-items", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters settlement items by settlementRunId", async () => {
      const channel = await seedChannel()
      const run1 = await seedSettlementRun(channel.id)
      const run2 = await seedSettlementRun(channel.id)
      await app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run1.id }),
      })
      await app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run2.id }),
      })
      const res = await app.request(`/settlement-items?settlementRunId=${run1.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.data.every((i: Record<string, unknown>) => i.settlementRunId === run1.id)).toBe(
        true,
      )
    })

    it("gets a settlement item by id", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const createRes = await app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const item = (await createRes.json()).data
      const res = await app.request(`/settlement-items/${item.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(item.id)
    })

    it("updates a settlement item", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const createRes = await app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const item = (await createRes.json()).data
      const res = await app.request(`/settlement-items/${item.id}`, {
        method: "PATCH",
        ...json({ status: "approved" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("approved")
    })

    it("deletes a settlement item", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const createRes = await app.request("/settlement-items", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const item = (await createRes.json()).data
      const res = await app.request(`/settlement-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement item", async () => {
      const res = await app.request("/settlement-items/chsi_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Reconciliation Runs ──────────────────────────────────

  describe("Reconciliation Runs CRUD", () => {
    it("creates a reconciliation run", async () => {
      const channel = await seedChannel()
      const res = await app.request("/reconciliation-runs", {
        method: "POST",
        ...json({
          channelId: channel.id,
          periodStart: "2025-01-01",
          periodEnd: "2025-01-31",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.status).toBe("draft")
    })

    it("lists reconciliation runs", async () => {
      const channel = await seedChannel()
      await seedReconciliationRun(channel.id)
      const res = await app.request("/reconciliation-runs", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a reconciliation run by id", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      const res = await app.request(`/reconciliation-runs/${run.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(run.id)
    })

    it("updates a reconciliation run", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      const res = await app.request(`/reconciliation-runs/${run.id}`, {
        method: "PATCH",
        ...json({ status: "running" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("running")
    })

    it("deletes a reconciliation run", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      const res = await app.request(`/reconciliation-runs/${run.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent reconciliation run", async () => {
      const res = await app.request("/reconciliation-runs/chrr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Reconciliation Items ─────────────────────────────────

  describe("Reconciliation Items CRUD", () => {
    it("creates a reconciliation item", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      const res = await app.request("/reconciliation-items", {
        method: "POST",
        ...json({
          reconciliationRunId: run.id,
          issueType: "amount_mismatch",
          severity: "error",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.issueType).toBe("amount_mismatch")
      expect(body.data.severity).toBe("error")
      expect(body.data.resolutionStatus).toBe("open")
    })

    it("lists reconciliation items", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      await app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const res = await app.request("/reconciliation-items", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters reconciliation items by issueType", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      await app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "missing_booking" }),
      })
      await app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "status_mismatch" }),
      })
      const res = await app.request("/reconciliation-items?issueType=missing_booking", {
        method: "GET",
      })
      const body = await res.json()
      expect(
        body.data.every((i: Record<string, unknown>) => i.issueType === "missing_booking"),
      ).toBe(true)
    })

    it("gets a reconciliation item by id", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      const createRes = await app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const item = (await createRes.json()).data
      const res = await app.request(`/reconciliation-items/${item.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(item.id)
    })

    it("updates a reconciliation item", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      const createRes = await app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const item = (await createRes.json()).data
      const res = await app.request(`/reconciliation-items/${item.id}`, {
        method: "PATCH",
        ...json({ resolutionStatus: "resolved", notes: "Fixed" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.resolutionStatus).toBe("resolved")
      expect(body.data.notes).toBe("Fixed")
    })

    it("deletes a reconciliation item", async () => {
      const channel = await seedChannel()
      const run = await seedReconciliationRun(channel.id)
      const createRes = await app.request("/reconciliation-items", {
        method: "POST",
        ...json({ reconciliationRunId: run.id, issueType: "other" }),
      })
      const item = (await createRes.json()).data
      const res = await app.request(`/reconciliation-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent reconciliation item", async () => {
      const res = await app.request("/reconciliation-items/chri_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Release Executions ───────────────────────────────────

  describe("Release Executions CRUD", () => {
    it("creates a release execution", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const res = await app.request("/inventory-release-executions", {
        method: "POST",
        ...json({
          allotmentId: allotment.id,
          actionTaken: "released",
          releasedCapacity: 5,
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.actionTaken).toBe("released")
      expect(body.data.releasedCapacity).toBe(5)
      expect(body.data.status).toBe("pending")
    })

    it("lists release executions", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      await app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const res = await app.request("/inventory-release-executions", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a release execution by id", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const createRes = await app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const exec = (await createRes.json()).data
      const res = await app.request(`/inventory-release-executions/${exec.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(exec.id)
    })

    it("updates a release execution", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const createRes = await app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const exec = (await createRes.json()).data
      const res = await app.request(`/inventory-release-executions/${exec.id}`, {
        method: "PATCH",
        ...json({ status: "completed" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.status).toBe("completed")
    })

    it("deletes a release execution", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const createRes = await app.request("/inventory-release-executions", {
        method: "POST",
        ...json({ allotmentId: allotment.id }),
      })
      const exec = (await createRes.json()).data
      const res = await app.request(`/inventory-release-executions/${exec.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent release execution", async () => {
      const res = await app.request(
        "/inventory-release-executions/chre_00000000000000000000000000",
        { method: "GET" },
      )
      expect(res.status).toBe(404)
    })
  })

  // ─── Settlement Policies ──────────────────────────────────

  describe("Settlement Policies CRUD", () => {
    it("creates a settlement policy", async () => {
      const channel = await seedChannel()
      const res = await app.request("/settlement-policies", {
        method: "POST",
        ...json({
          channelId: channel.id,
          frequency: "weekly",
          autoGenerate: true,
          currencyCode: "USD",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.frequency).toBe("weekly")
      expect(body.data.autoGenerate).toBe(true)
    })

    it("lists settlement policies", async () => {
      const channel = await seedChannel()
      await app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const res = await app.request("/settlement-policies", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a settlement policy by id", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await app.request(`/settlement-policies/${policy.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(policy.id)
    })

    it("updates a settlement policy", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await app.request(`/settlement-policies/${policy.id}`, {
        method: "PATCH",
        ...json({ frequency: "monthly", approvalRequired: true }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.frequency).toBe("monthly")
      expect(body.data.approvalRequired).toBe(true)
    })

    it("deletes a settlement policy", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/settlement-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await app.request(`/settlement-policies/${policy.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement policy", async () => {
      const res = await app.request("/settlement-policies/chsp_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Reconciliation Policies ──────────────────────────────

  describe("Reconciliation Policies CRUD", () => {
    it("creates a reconciliation policy", async () => {
      const channel = await seedChannel()
      const res = await app.request("/reconciliation-policies", {
        method: "POST",
        ...json({
          channelId: channel.id,
          frequency: "daily",
          autoRun: true,
          amountToleranceCents: 100,
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.frequency).toBe("daily")
      expect(body.data.autoRun).toBe(true)
      expect(body.data.amountToleranceCents).toBe(100)
    })

    it("lists reconciliation policies", async () => {
      const channel = await seedChannel()
      await app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const res = await app.request("/reconciliation-policies", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a reconciliation policy by id", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await app.request(`/reconciliation-policies/${policy.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(policy.id)
    })

    it("updates a reconciliation policy", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await app.request(`/reconciliation-policies/${policy.id}`, {
        method: "PATCH",
        ...json({ compareGrossAmounts: false }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.compareGrossAmounts).toBe(false)
    })

    it("deletes a reconciliation policy", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/reconciliation-policies", {
        method: "POST",
        ...json({ channelId: channel.id }),
      })
      const policy = (await createRes.json()).data
      const res = await app.request(`/reconciliation-policies/${policy.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent reconciliation policy", async () => {
      const res = await app.request("/reconciliation-policies/chrp_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Release Schedules ────────────────────────────────────

  describe("Release Schedules CRUD", () => {
    it("creates a release schedule", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      const res = await app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id, scheduleKind: "daily" }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.scheduleKind).toBe("daily")
      expect(body.data.active).toBe(true)
    })

    it("lists release schedules", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      await app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const res = await app.request("/release-schedules", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a release schedule by id", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      const createRes = await app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const schedule = (await createRes.json()).data
      const res = await app.request(`/release-schedules/${schedule.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(schedule.id)
    })

    it("updates a release schedule", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      const createRes = await app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const schedule = (await createRes.json()).data
      const res = await app.request(`/release-schedules/${schedule.id}`, {
        method: "PATCH",
        ...json({ scheduleKind: "hourly", active: false }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.scheduleKind).toBe("hourly")
      expect(body.data.active).toBe(false)
    })

    it("deletes a release schedule", async () => {
      const channel = await seedChannel()
      const product = await seedProduct()
      const allotment = await seedInventoryAllotment(channel.id, product.id)
      const rule = await seedReleaseRule(allotment.id)
      const createRes = await app.request("/release-schedules", {
        method: "POST",
        ...json({ releaseRuleId: rule.id }),
      })
      const schedule = (await createRes.json()).data
      const res = await app.request(`/release-schedules/${schedule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent release schedule", async () => {
      const res = await app.request("/release-schedules/chrs_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Remittance Exceptions ────────────────────────────────

  describe("Remittance Exceptions CRUD", () => {
    it("creates a remittance exception", async () => {
      const channel = await seedChannel()
      const res = await app.request("/remittance-exceptions", {
        method: "POST",
        ...json({
          channelId: channel.id,
          exceptionType: "underpayment",
          severity: "error",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.exceptionType).toBe("underpayment")
      expect(body.data.severity).toBe("error")
      expect(body.data.status).toBe("open")
    })

    it("lists remittance exceptions", async () => {
      const channel = await seedChannel()
      await app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "duplicate" }),
      })
      const res = await app.request("/remittance-exceptions", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("gets a remittance exception by id", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "test" }),
      })
      const exception = (await createRes.json()).data
      const res = await app.request(`/remittance-exceptions/${exception.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(exception.id)
    })

    it("updates a remittance exception", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "test" }),
      })
      const exception = (await createRes.json()).data
      const res = await app.request(`/remittance-exceptions/${exception.id}`, {
        method: "PATCH",
        ...json({ status: "resolved", notes: "Resolved manually" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("resolved")
      expect(body.data.notes).toBe("Resolved manually")
    })

    it("deletes a remittance exception", async () => {
      const channel = await seedChannel()
      const createRes = await app.request("/remittance-exceptions", {
        method: "POST",
        ...json({ channelId: channel.id, exceptionType: "test" }),
      })
      const exception = (await createRes.json()).data
      const res = await app.request(`/remittance-exceptions/${exception.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent remittance exception", async () => {
      const res = await app.request("/remittance-exceptions/chre_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  // ─── Settlement Approvals ─────────────────────────────────

  describe("Settlement Approvals CRUD", () => {
    it("creates a settlement approval", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const res = await app.request("/settlement-approvals", {
        method: "POST",
        ...json({
          settlementRunId: run.id,
          approverUserId: "user_approver1",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.approverUserId).toBe("user_approver1")
      expect(body.data.status).toBe("pending")
    })

    it("lists settlement approvals", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      await app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const res = await app.request("/settlement-approvals", { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).total).toBeGreaterThanOrEqual(1)
    })

    it("filters settlement approvals by status", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      await app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const res = await app.request("/settlement-approvals?status=pending", { method: "GET" })
      const body = await res.json()
      expect(body.data.every((a: Record<string, unknown>) => a.status === "pending")).toBe(true)
    })

    it("gets a settlement approval by id", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const createRes = await app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const approval = (await createRes.json()).data
      const res = await app.request(`/settlement-approvals/${approval.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.id).toBe(approval.id)
    })

    it("updates a settlement approval", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const createRes = await app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const approval = (await createRes.json()).data
      const res = await app.request(`/settlement-approvals/${approval.id}`, {
        method: "PATCH",
        ...json({ status: "approved", notes: "Looks good" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("approved")
      expect(body.data.notes).toBe("Looks good")
    })

    it("deletes a settlement approval", async () => {
      const channel = await seedChannel()
      const run = await seedSettlementRun(channel.id)
      const createRes = await app.request("/settlement-approvals", {
        method: "POST",
        ...json({ settlementRunId: run.id }),
      })
      const approval = (await createRes.json()).data
      const res = await app.request(`/settlement-approvals/${approval.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent settlement approval", async () => {
      const res = await app.request("/settlement-approvals/chsa_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })
})
