import { Hono } from "hono"
import { beforeAll, beforeEach, expect } from "vitest"

import { facilitiesRoutes } from "../../../src/places/routes.js"

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

export function createFacilitiesTestContext() {
  let app!: Hono
  let db!: ReturnType<typeof import("@voyantjs/db/test-utils").createTestDb>

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
    app.route("/", facilitiesRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedFacility(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/operations", {
      method: "POST",
      ...json({
        kind: "hotel",
        name: `Facility ${nextSeq()}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; [key: string]: unknown }
  }

  async function seedProperty(facilityId: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request("/properties", {
      method: "POST",
      ...json({ facilityId, ...overrides }),
    })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; facilityId: string; [key: string]: unknown }
  }

  async function seedPropertyGroup(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/property-groups", {
      method: "POST",
      ...json({ name: `Group ${nextSeq()}`, ...overrides }),
    })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; [key: string]: unknown }
  }

  return {
    request: (path: string, init?: RequestInit) => app.request(path, init),
    seedFacility,
    seedProperty,
    seedPropertyGroup,
  }
}
