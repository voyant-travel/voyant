import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { beforeAll, beforeEach } from "vitest"

import { distributionRoutes } from "../../src/routes.js"

export const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

export const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let channelSeq = 0
function nextChannelName() {
  channelSeq++
  return `Channel-${String(channelSeq).padStart(4, "0")}`
}

export function setupDistributionRoutes() {
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
    app.route("/", distributionRoutes)
    app.onError(handleApiError)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
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
    const { products } = await import("../../../inventory/src/schema.js")
    const [row] = await (db as never as import("drizzle-orm/postgres-js").PostgresJsDatabase)
      .insert(products)
      .values({ name: `Test Product ${Date.now()}`, sellCurrency: "USD" })
      .returning()
    return row!
  }

  async function seedBooking() {
    const { bookings } = await import("@voyant-travel/bookings/schema")
    const [row] = await (db as never as import("drizzle-orm/postgres-js").PostgresJsDatabase)
      .insert(bookings)
      .values({
        bookingNumber: `BK-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sellCurrency: "USD",
      })
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

  return {
    get app() {
      return app
    },
    get db() {
      return db
    },
    seedChannel,
    seedContract,
    seedProduct,
    seedBooking,
    seedSettlementRun,
    seedReconciliationRun,
    seedInventoryAllotment,
    seedReleaseRule,
  }
}
