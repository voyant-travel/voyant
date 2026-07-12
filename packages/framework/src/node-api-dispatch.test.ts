import type { FetchApp, WaitUntilContext } from "@voyant-travel/runtime/types"
import { describe, expect, it, vi } from "vitest"

import { createVoyantNodeApiDispatch } from "./node-api-dispatch.js"

interface TestEnvironment {
  APP_URL: string
  CORS_ALLOWLIST: string
}

describe("createVoyantNodeApiDispatch", () => {
  it("routes and rewrites API requests without loading the full app for auth preflight", async () => {
    const loadApiApp = vi.fn<() => Promise<FetchApp<TestEnvironment>>>()
    const loadAuthHandler = vi.fn(async () => ({ fetch: vi.fn() }))
    const dispatch = createVoyantNodeApiDispatch<TestEnvironment>({
      loadApiApp,
      loadAuthHandler,
      rewriteAppPath: (pathname) =>
        pathname.startsWith("/v1/media/")
          ? pathname.replace("/v1/media/", "/v1/admin/media/")
          : pathname,
    })

    expect(dispatch.isApiRequest("/api/v1/products")).toBe(true)
    expect(dispatch.isAuthRequest("/api/auth/me")).toBe(true)
    expect(
      dispatch.toAppRequest(new Request("https://example.test/api/v1/media/photo.png?q=1")).url,
    ).toBe("https://example.test/v1/admin/media/photo.png?q=1")

    const waitUntil = vi.fn()
    const response = await dispatch.dispatch(
      new Request("https://example.test/api/auth/me", {
        method: "OPTIONS",
        headers: {
          origin: "https://dashboard.example",
          "access-control-request-method": "GET",
        },
      }),
      {
        APP_URL: "https://example.test",
        CORS_ALLOWLIST: "https://dashboard.example",
      },
      { waitUntil } satisfies WaitUntilContext,
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe("https://dashboard.example")
    expect(loadApiApp).not.toHaveBeenCalled()
    expect(loadAuthHandler).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
  })
})
