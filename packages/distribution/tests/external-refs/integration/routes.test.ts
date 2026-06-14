import { externalRefsRoutes } from "@voyant-travel/distribution"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0
function nextExternalId() {
  seq++
  return `ext-${String(seq).padStart(4, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("External Refs routes", () => {
  let app: Hono
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", externalRefsRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  // ─── Helpers ──────────────────────────────────────────────

  async function seedRef(overrides: Record<string, unknown> = {}) {
    const body = {
      entityType: "product",
      entityId: "prod_00000000000000000000000001",
      sourceSystem: "bokun",
      objectType: "activity",
      externalId: nextExternalId(),
      ...overrides,
    }
    const res = await app.request("/refs", { method: "POST", ...json(body) })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; [k: string]: unknown }
  }

  // ─── CRUD ─────────────────────────────────────────────────

  describe("Create external ref", () => {
    it("creates a ref with required fields", async () => {
      const ref = await seedRef()
      expect(ref.id).toMatch(/^exrf_/)
      expect(ref.entityType).toBe("product")
      expect(ref.sourceSystem).toBe("bokun")
      expect(ref.status).toBe("active")
      expect(ref.isPrimary).toBe(false)
      expect(ref.namespace).toBe("default")
    })

    it("creates a ref with all optional fields", async () => {
      const ref = await seedRef({
        namespace: "eu",
        externalParentId: "parent-123",
        isPrimary: true,
        status: "inactive",
        lastSyncedAt: "2024-06-01T00:00:00Z",
        metadata: { region: "europe" },
      })
      expect(ref.namespace).toBe("eu")
      expect(ref.externalParentId).toBe("parent-123")
      expect(ref.isPrimary).toBe(true)
      expect(ref.status).toBe("inactive")
      expect(ref.lastSyncedAt).toBeTruthy()
      expect(ref.metadata).toEqual({ region: "europe" })
    })

    it("rejects missing required fields", async () => {
      const res = await app.request("/refs", {
        method: "POST",
        ...json({ entityType: "product" }),
      })
      // Zod parse throws → 500 (no error boundary at module level)
      expect(res.status).toBe(500)
    })
  })

  describe("Get external ref", () => {
    it("gets a ref by id", async () => {
      const created = await seedRef()
      const res = await app.request(`/refs/${created.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(created.id)
    })

    it("returns 404 for non-existent ref", async () => {
      const res = await app.request("/refs/exrf_00000000000000000000000000", { method: "GET" })
      expect(res.status).toBe(404)
    })
  })

  describe("Update external ref", () => {
    it("updates status", async () => {
      const ref = await seedRef()
      const res = await app.request(`/refs/${ref.id}`, {
        method: "PATCH",
        ...json({ status: "archived" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.status).toBe("archived")
    })

    it("updates metadata", async () => {
      const ref = await seedRef({ metadata: { a: 1 } })
      const res = await app.request(`/refs/${ref.id}`, {
        method: "PATCH",
        ...json({ metadata: { b: 2 } }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.metadata).toEqual({ b: 2 })
    })

    it("returns 404 for non-existent ref", async () => {
      const res = await app.request("/refs/exrf_00000000000000000000000000", {
        method: "PATCH",
        ...json({ status: "inactive" }),
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Delete external ref", () => {
    it("deletes a ref", async () => {
      const ref = await seedRef()
      const res = await app.request(`/refs/${ref.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      const check = await app.request(`/refs/${ref.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })

    it("returns 404 for non-existent ref", async () => {
      const res = await app.request("/refs/exrf_00000000000000000000000000", { method: "DELETE" })
      expect(res.status).toBe(404)
    })
  })

  // ─── List & Filtering ─────────────────────────────────────

  describe("List external refs", () => {
    it("lists refs with pagination", async () => {
      await seedRef()
      await seedRef()
      await seedRef()
      const res = await app.request("/refs?limit=2&offset=0", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
      expect(body.limit).toBe(2)
      expect(body.offset).toBe(0)
    })

    it("filters by entityType", async () => {
      await seedRef({ entityType: "product" })
      await seedRef({ entityType: "supplier" })
      const res = await app.request("/refs?entityType=product", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].entityType).toBe("product")
    })

    it("filters by sourceSystem", async () => {
      await seedRef({ sourceSystem: "bokun" })
      await seedRef({ sourceSystem: "viator" })
      const res = await app.request("/refs?sourceSystem=viator", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].sourceSystem).toBe("viator")
    })

    it("filters by status", async () => {
      await seedRef({ status: "active" })
      await seedRef({ status: "inactive" })
      const res = await app.request("/refs?status=inactive", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].status).toBe("inactive")
    })

    it("searches by externalId", async () => {
      const ref = await seedRef({ externalId: "BOKUN-12345" })
      await seedRef({ externalId: "VIATOR-99999" })
      const res = await app.request("/refs?search=BOKUN", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].id).toBe(ref.id)
    })

    it("returns empty list when no matches", async () => {
      const res = await app.request("/refs?entityType=nonexistent", { method: "GET" })
      const body = await res.json()
      expect(body.data).toEqual([])
      expect(body.total).toBe(0)
    })
  })

  // ─── Entity-scoped routes ─────────────────────────────────

  describe("Entity-scoped refs", () => {
    it("lists refs for a specific entity", async () => {
      const entityId = "prod_00000000000000000000000099"
      await seedRef({ entityType: "product", entityId })
      await seedRef({ entityType: "product", entityId, sourceSystem: "viator" })
      await seedRef({ entityType: "product", entityId: "prod_00000000000000000000000088" })

      const res = await app.request(`/entities/product/${entityId}/refs`, { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("creates a ref scoped to an entity", async () => {
      const res = await app.request("/entities/supplier/supp_00000000000000000000000001/refs", {
        method: "POST",
        ...json({
          sourceSystem: "bokun",
          objectType: "supplier",
          externalId: "BK-SUPP-001",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.entityType).toBe("supplier")
      expect(data.entityId).toBe("supp_00000000000000000000000001")
      expect(data.sourceSystem).toBe("bokun")
    })

    it("entity-scoped list applies additional filters", async () => {
      const entityId = "prod_00000000000000000000000077"
      await seedRef({ entityType: "product", entityId, sourceSystem: "bokun" })
      await seedRef({ entityType: "product", entityId, sourceSystem: "viator" })

      const res = await app.request(`/entities/product/${entityId}/refs?sourceSystem=viator`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].sourceSystem).toBe("viator")
    })
  })

  // ─── Primary ref management ────────────────────────────────

  describe("Primary ref management", () => {
    it("demotes existing primary when creating a new primary ref", async () => {
      const first = await seedRef({
        entityType: "product",
        entityId: "prod_00000000000000000000000055",
        sourceSystem: "bokun",
        isPrimary: true,
      })
      expect(first.isPrimary).toBe(true)

      const second = await seedRef({
        entityType: "product",
        entityId: "prod_00000000000000000000000055",
        sourceSystem: "bokun",
        externalId: nextExternalId(),
        objectType: "tour",
        isPrimary: true,
      })
      expect(second.isPrimary).toBe(true)

      // First should now be demoted
      const check = await app.request(`/refs/${first.id}`, { method: "GET" })
      const { data } = await check.json()
      expect(data.isPrimary).toBe(false)
    })

    it("demotes existing primary when updating a ref to primary", async () => {
      const entityId = "prod_00000000000000000000000066"
      const first = await seedRef({
        entityType: "product",
        entityId,
        sourceSystem: "bokun",
        isPrimary: true,
      })
      const second = await seedRef({
        entityType: "product",
        entityId,
        sourceSystem: "bokun",
        externalId: nextExternalId(),
        objectType: "tour",
      })

      const res = await app.request(`/refs/${second.id}`, {
        method: "PATCH",
        ...json({ isPrimary: true }),
      })
      expect(res.status).toBe(200)
      const { data: updated } = await res.json()
      expect(updated.isPrimary).toBe(true)

      // First should be demoted
      const check = await app.request(`/refs/${first.id}`, { method: "GET" })
      const { data: firstNow } = await check.json()
      expect(firstNow.isPrimary).toBe(false)
    })

    it("does not demote primaries from a different source system", async () => {
      const entityId = "prod_00000000000000000000000044"
      const bokunRef = await seedRef({
        entityType: "product",
        entityId,
        sourceSystem: "bokun",
        isPrimary: true,
      })
      await seedRef({
        entityType: "product",
        entityId,
        sourceSystem: "viator",
        isPrimary: true,
      })

      // Bokun primary should remain untouched
      const check = await app.request(`/refs/${bokunRef.id}`, { method: "GET" })
      const { data } = await check.json()
      expect(data.isPrimary).toBe(true)
    })
  })
})
