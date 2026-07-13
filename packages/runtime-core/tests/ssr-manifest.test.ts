import { describe, expect, it, vi } from "vitest"
import {
  restrictSsrManifestToActiveRoutes,
  type SsrManifestRouter,
  withActiveRouteSsrManifest,
} from "../src/ssr-manifest.js"

function makeRouter(activeRouteIds: string[], manifestRouteIds: string[]): SsrManifestRouter {
  return {
    stores: {
      matches: {
        get: () => activeRouteIds.map((routeId) => ({ routeId })),
      },
    },
    ssr: {
      manifest: {
        inlineCss: ":root{}",
        routes: Object.fromEntries(manifestRouteIds.map((id) => [id, { preloads: [`${id}.js`] }])),
      },
    },
  }
}

describe("restrictSsrManifestToActiveRoutes", () => {
  it("filters the manifest down to active route matches", () => {
    const router = makeRouter(["/", "/bookings"], ["/", "/bookings", "/finance", "/products"])

    restrictSsrManifestToActiveRoutes(router)

    expect(Object.keys(router.ssr?.manifest?.routes ?? {})).toEqual(["/", "/bookings"])
  })

  it("preserves manifest fields other than routes", () => {
    const router = makeRouter(["/"], ["/", "/finance"])

    restrictSsrManifestToActiveRoutes(router)

    expect(router.ssr?.manifest?.inlineCss).toBe(":root{}")
  })

  it("re-evaluates matches on every manifest read", () => {
    const matches = vi.fn(() => [{ routeId: "/" }])
    const router: SsrManifestRouter = {
      stores: { matches: { get: matches } },
      ssr: { manifest: { routes: { "/": {}, "/finance": {} } } },
    }

    restrictSsrManifestToActiveRoutes(router)
    void router.ssr?.manifest
    matches.mockReturnValue([{ routeId: "/finance" }])
    const second = router.ssr?.manifest

    expect(matches).toHaveBeenCalledTimes(2)
    expect(Object.keys(second?.routes ?? {})).toEqual(["/finance"])
  })

  it("is a no-op without an SSR manifest", () => {
    const router: SsrManifestRouter = {
      stores: { matches: { get: () => [] } },
    }

    expect(() => restrictSsrManifestToActiveRoutes(router)).not.toThrow()
    expect(router.ssr).toBeUndefined()
  })
})

describe("withActiveRouteSsrManifest", () => {
  it("restricts the manifest before delegating to the handler", () => {
    const router = makeRouter(["/"], ["/", "/finance"])
    const handler = vi.fn((ctx: { router: unknown }) => {
      const restricted = (ctx.router as SsrManifestRouter).ssr?.manifest
      return Object.keys(restricted?.routes ?? {})
    })

    const result = withActiveRouteSsrManifest(handler)({ router })

    expect(handler).toHaveBeenCalledOnce()
    expect(result).toEqual(["/"])
  })
})
