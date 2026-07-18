import { describe, expect, it } from "vitest"
import {
  assembleClientAuthenticatedRoutes,
  matchesClientAuthenticatedRoute,
} from "../../src/client-authenticated-routes.js"

describe("client-authenticated routes", () => {
  it("rejects parameterized and wildcard declarations", () => {
    expect(() =>
      assembleClientAuthenticatedRoutes([
        {
          module: { name: "apps" },
          clientAuthenticated: [{ method: "POST", path: "/oauth/:operation" }],
        },
      ]),
    ).toThrow(/concrete relative path/)

    expect(() =>
      assembleClientAuthenticatedRoutes([
        {
          module: { name: "apps" },
          clientAuthenticated: [{ method: "POST", path: "/oauth/*" }],
        },
      ]),
    ).toThrow(/concrete relative path/)
  })

  it("matches method and normalized path by equality only", () => {
    const routes = assembleClientAuthenticatedRoutes([
      {
        module: { name: "apps" },
        clientAuthenticated: [{ method: "POST", path: "/oauth/token/" }],
      },
    ])

    expect(matchesClientAuthenticatedRoute("POST", "/v1/admin/apps/oauth/token", routes)).toBe(true)
    expect(matchesClientAuthenticatedRoute("GET", "/v1/admin/apps/oauth/token", routes)).toBe(false)
    expect(
      matchesClientAuthenticatedRoute("POST", "/v1/admin/apps/oauth/token/extra", routes),
    ).toBe(false)
  })
})
