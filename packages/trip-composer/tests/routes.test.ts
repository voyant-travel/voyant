import { describe, expect, it } from "vitest"
import { createTripComposerRoutes } from "../src/routes.js"

describe("trip composer routes", () => {
  it("exposes package health", async () => {
    const app = createTripComposerRoutes()
    const res = await app.request("/health")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      data: {
        module: "trip-composer",
        status: "scaffolded",
      },
    })
  })

  it("keeps adapter-backed operations unavailable until runtime deps are configured", async () => {
    const app = createTripComposerRoutes()
    const res = await app.request("/trips/trip_123/checkout", {
      method: "POST",
      body: JSON.stringify({ intent: "card" }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(501)
    await expect(res.json()).resolves.toEqual({
      error: "Trip composer checkout dependencies are not configured",
    })
  })

  it("blocks admin-only mutation routes on the public surface", async () => {
    const app = createTripComposerRoutes({ surface: "public" })
    const res = await app.request("/components/trcp_123/refs", {
      method: "POST",
      body: JSON.stringify({ catalogQuoteId: "quote_123" }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: "Trip composer operation is admin-only",
    })
  })

  it("blocks support cancellation routes on the public surface", async () => {
    const app = createTripComposerRoutes({ surface: "public" })
    const res = await app.request("/trips/trip_123/cancellation-preview", {
      method: "POST",
      body: JSON.stringify({ componentIds: ["trcp_123"] }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: "Trip composer operation is admin-only",
    })
  })
})
