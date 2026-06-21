import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

// A sentinel registry object the wrapper should inject into context. Hoisted so
// the vi.mock factories below can reference it.
const SENTINEL = vi.hoisted(() => ({ marker: "source-adapter-registry" }))

vi.mock("../lib/booking-engine-runtime", () => ({
  getBookingEngineRegistryFromContext: () => SENTINEL,
}))

// Stub the package cruise routes with a probe that reports whether the wrapper
// middleware set `sourceAdapterRegistry` to the sentinel before they ran.
const probeRoutes = () =>
  new Hono().get("/probe", (c) =>
    c.json({ injected: c.get("sourceAdapterRegistry" as never) === SENTINEL }),
  )
vi.mock("@voyant-travel/cruises/routes", () => ({ cruiseAdminRoutes: probeRoutes() }))
vi.mock("@voyant-travel/cruises/public-routes", () => ({ cruisePublicRoutes: probeRoutes() }))

describe("cruise route wrapper", () => {
  it("injects the booking-engine SourceAdapterRegistry into context for admin routes", async () => {
    const { createCruiseAdminRoutes } = await import("./cruises")
    const res = await createCruiseAdminRoutes().request("/probe")
    expect(await res.json()).toEqual({ injected: true })
  })

  it("injects the booking-engine SourceAdapterRegistry into context for public routes", async () => {
    const { createCruisePublicRoutes } = await import("./cruises")
    const res = await createCruisePublicRoutes().request("/probe")
    expect(await res.json()).toEqual({ injected: true })
  })
})
