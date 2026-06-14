import { describe, expect, it } from "vitest"
import { createTripsRoutes } from "../src/routes.js"

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
})
