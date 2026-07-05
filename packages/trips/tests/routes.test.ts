import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createTripsRoutes } from "../src/routes.js"
import { tripsService } from "../src/service.js"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("trips routes", () => {
  it("exposes package health", async () => {
    const app = createTripsRoutes()
    const res = await app.request("/health")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      data: {
        module: "trips",
        status: "scaffolded",
      },
    })
  })

  it("keeps adapter-backed operations unavailable until runtime deps are configured", async () => {
    const app = createTripsRoutes()
    const res = await app.request("/trip_123/checkout", {
      method: "POST",
      body: JSON.stringify({ intent: "card" }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(501)
    await expect(res.json()).resolves.toEqual({
      error: "Trips checkout dependencies are not configured",
    })
  })

  it("blocks admin-only mutation routes on the public surface", async () => {
    const app = createTripsRoutes({ surface: "public" })
    const res = await app.request("/components/trcp_123/refs", {
      method: "POST",
      body: JSON.stringify({ catalogQuoteId: "quote_123" }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: "Trips operation is admin-only",
    })
  })

  it("blocks support cancellation routes on the public surface", async () => {
    const app = createTripsRoutes({ surface: "public" })
    const res = await app.request("/trip_123/cancellation-preview", {
      method: "POST",
      body: JSON.stringify({ componentIds: ["trcp_123"] }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: "Trips operation is admin-only",
    })
  })

  it("blocks requirement routes on the public surface", async () => {
    const app = createTripsRoutes({ surface: "public" })
    // Bodies are valid so the migrated routes reach the admin-only surface
    // guard (403) rather than tripping the OpenAPI body validator (400) first.
    const scope = { locale: "en-GB", audience: "staff", market: "GB" }
    const adminOnly = [
      {
        method: "POST",
        path: "/trip_123/requirements",
        body: { vertical: "accommodation", criteriaVersion: "v1" },
      },
      { method: "GET", path: "/trip_123/requirements" },
      { method: "POST", path: "/requirements/trrq_1/candidates", body: { scope } },
      { method: "POST", path: "/requirements/trrq_1/select", body: { candidateId: "trcd_1" } },
      { method: "POST", path: "/requirements/trrq_1/reshop", body: { scope } },
      { method: "POST", path: "/trip_123/reshop", body: { scope } },
    ]
    for (const { method, path, body } of adminOnly) {
      const res = await app.request(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { "content-type": "application/json" },
      })
      expect(res.status, `${method} ${path}`).toBe(403)
    }
  })

  it("reports 501 for sourcing/reshop until the availability fan-out is wired", async () => {
    const app = createTripsRoutes()
    const scope = { locale: "en-GB", audience: "staff", market: "GB" }

    const source = await app.request("/requirements/trrq_1/candidates", {
      method: "POST",
      body: JSON.stringify({ scope }),
      headers: { "content-type": "application/json" },
    })
    expect(source.status).toBe(501)
    await expect(source.json()).resolves.toEqual({
      error: "Trips availability-sourcing dependencies are not configured",
    })

    const reshop = await app.request("/trip_123/reshop", {
      method: "POST",
      body: JSON.stringify({ scope }),
      headers: { "content-type": "application/json" },
    })
    expect(reshop.status).toBe(501)
  })

  it("resolves lazy route options only when an injected dependency is needed", async () => {
    vi.spyOn(tripsService, "reserveTrip")
      .mockResolvedValueOnce({
        envelope: { id: "trip_123", status: "reserved" },
        components: [],
        reservationPlanId: "trpl_1",
        reserved: [],
        failures: [],
        compensations: [],
        warnings: [],
      } as never)
      .mockResolvedValueOnce({
        envelope: { id: "trip_123", status: "reserved" },
        components: [],
        reservationPlanId: "trpl_1",
        reserved: [],
        failures: [],
        compensations: [],
        warnings: [],
      } as never)
    const submitReservationPlan = vi.fn()
    const routeOptions = vi.fn(async () => ({
      reserveTripDeps: { submitReservationPlan },
    }))
    const app = appWithDb(createTripsRoutes(routeOptions))

    expect(routeOptions).not.toHaveBeenCalled()

    const health = await app.request("/health")
    expect(health.status).toBe(200)
    expect(routeOptions).not.toHaveBeenCalled()

    const firstReserve = await app.request("/trip_123/reserve", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    })
    expect(firstReserve.status).toBe(200)
    expect(routeOptions).toHaveBeenCalledTimes(1)

    const secondReserve = await app.request("/trip_123/reserve", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    })
    expect(secondReserve.status).toBe(200)
    expect(routeOptions).toHaveBeenCalledTimes(1)
  })

  it("returns a conflict response when reserve produces component failures", async () => {
    vi.spyOn(tripsService, "reserveTrip").mockResolvedValueOnce({
      envelope: { id: "trip_123", status: "failed" },
      components: [],
      reservationPlanId: "trpl_1",
      reserved: [],
      failures: [
        {
          componentId: "trcp_1",
          reason: "component_reservation_failed",
          code: "component_reservation_failed",
        },
      ],
      compensations: [],
      warnings: ["component_reservation_failed"],
    } as never)
    const app = appWithDb(
      createTripsRoutes({
        reserveTripDeps: { submitReservationPlan: vi.fn() },
      }),
    )

    const res = await app.request("/trip_123/reserve", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "reserve-1" }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "Trip reservation failed",
      data: {
        envelope: { id: "trip_123", status: "failed" },
        components: [],
        reservationPlanId: "trpl_1",
        reserved: [],
        failures: [
          {
            componentId: "trcp_1",
            reason: "component_reservation_failed",
            code: "component_reservation_failed",
          },
        ],
        compensations: [],
        warnings: ["component_reservation_failed"],
      },
      failures: [
        {
          componentId: "trcp_1",
          reason: "component_reservation_failed",
          code: "component_reservation_failed",
        },
      ],
      reservationPlanId: "trpl_1",
    })
  })

  it("sanitizes raw SQL errors thrown by reserve dependencies", async () => {
    vi.spyOn(tripsService, "reserveTrip").mockRejectedValueOnce(
      new Error('Failed query: insert into "booking_payment_schedules" values ($1)\nparams: x'),
    )
    const app = appWithDb(
      createTripsRoutes({
        reserveTripDeps: { submitReservationPlan: vi.fn() },
      }),
    )

    const res = await app.request("/trip_123/reserve", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Trips route failed" })
  })
})

function appWithDb(routes: ReturnType<typeof createTripsRoutes>) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, {} as never)
    await next()
  })
  app.route("/", routes)
  return app
}
