import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { supplierRoutes } from "../../src/routes.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("Supplier routes", () => {
  let app: Hono

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    const db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", supplierRoutes)
  })

  beforeEach(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(createTestDb())
  })

  it("creates a supplier", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Hotel",
        type: "hotel",
        status: "active",
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe("Test Hotel")
  })

  it("round-trips supplier reservation timeout", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Timed Supplier",
        type: "experience",
        status: "active",
        reservationTimeoutMinutes: 18,
      }),
    })

    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.data.reservationTimeoutMinutes).toBe(18)

    const updateRes = await app.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationTimeoutMinutes: 0 }),
    })

    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.data.reservationTimeoutMinutes).toBe(0)
  })

  it("lists suppliers", async () => {
    const res = await app.request("/", { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
  })

  it("searches suppliers through the supplier directory projection", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Projection Tours",
        type: "experience",
        status: "active",
        email: "ops@projection.example",
        address: "Projection Street 1",
        city: "Cluj-Napoca",
        country: "RO",
        contactName: "Projection Ops",
        contactEmail: "contact@projection.example",
      }),
    })

    expect(createRes.status).toBe(201)

    const res = await app.request("/?search=projection%20ops", { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.name).toBe("Projection Tours")
    expect(body.data[0]?.contactEmail).toBe("contact@projection.example")
  })
})
