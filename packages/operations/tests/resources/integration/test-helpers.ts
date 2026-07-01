import { Hono } from "hono"
import { beforeAll, beforeEach, expect } from "vitest"

export const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

export const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0

function nextSeq() {
  seq++
  return String(seq).padStart(4, "0")
}

export function createResourcesTestContext() {
  let app!: Hono
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: resources; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    const { resourcesRoutes } = await import("../../../src/resources/routes.js")

    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", resourcesRoutes)
  })

  beforeEach(async () => {
    seq = 0
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedResource(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/", {
      method: "POST",
      ...json({
        kind: "guide",
        name: `Resource ${nextSeq()}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedPool(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/pools", {
      method: "POST",
      ...json({
        kind: "guide",
        name: `Pool ${nextSeq()}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedPoolMember(poolId: string, resourceId: string) {
    const res = await app.request("/pool-members", {
      method: "POST",
      ...json({ poolId, resourceId }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedProductDirect() {
    const { products } = await import("../../../../inventory/src/schema.js")
    const [row] = await db
      .insert(products)
      .values({ name: `Product ${nextSeq()}`, sellCurrency: "USD" })
      .returning()
    return row
  }

  async function seedAvailabilitySlotDirect(productId: string) {
    const { availabilitySlots } = await import("../../../src/index.js")
    const [row] = await db
      .insert(availabilitySlots)
      .values({
        productId,
        dateLocal: "2025-06-15",
        startsAt: new Date("2025-06-15T09:00:00Z"),
        timezone: "UTC",
      })
      .returning()
    return row
  }

  async function seedRequirement(
    poolId: string,
    productId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request("/requirements", {
      method: "POST",
      ...json({
        poolId,
        productId,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedSlotAssignment(slotId: string, overrides: Record<string, unknown> = {}) {
    const target =
      "poolId" in overrides || "resourceId" in overrides ? {} : { poolId: (await seedPool()).id }
    const res = await app.request("/slot-assignments", {
      method: "POST",
      ...json({
        slotId,
        ...target,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedCloseout(resourceId: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request("/closeouts", {
      method: "POST",
      ...json({
        resourceId,
        dateLocal: "2025-07-01",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  return {
    request: (path: string, init?: RequestInit) => app.request(path, init),
    seedAvailabilitySlotDirect,
    seedCloseout,
    seedPool,
    seedPoolMember,
    seedProductDirect,
    seedRequirement,
    seedResource,
    seedSlotAssignment,
  }
}
