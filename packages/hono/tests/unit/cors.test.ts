import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { cors } from "../../src/middleware/cors.js"
import type { VoyantBindings } from "../../src/types.js"

describe("cors middleware", () => {
  it("returns allowlist headers on preflight responses", async () => {
    const app = new Hono<{ Bindings: VoyantBindings }>()
    app.use("*", cors())
    app.get("/auth/me", (c) => c.json({ ok: true }))

    const response = await app.fetch(
      new Request("https://api.example/auth/me", {
        method: "OPTIONS",
        headers: {
          origin: "https://dashboard.example",
          "access-control-request-method": "GET",
          "access-control-request-headers": "content-type",
        },
      }),
      {
        CORS_ALLOWLIST: "https://dashboard.example",
      },
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe("https://dashboard.example")
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
    expect(response.headers.get("access-control-allow-methods")).toBe("GET")
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type")
    expect(response.headers.get("vary")).toBe("Origin")
  })

  it("does not allow credentialed bare wildcard origins", async () => {
    const app = new Hono<{ Bindings: VoyantBindings }>()
    app.use("*", cors())

    const response = await app.fetch(
      new Request("https://api.example/auth/me", {
        method: "OPTIONS",
        headers: {
          origin: "https://attacker.example",
          "access-control-request-method": "GET",
        },
      }),
      { CORS_ALLOWLIST: "*" },
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("keeps localhost origins exact", async () => {
    const app = new Hono<{ Bindings: VoyantBindings }>()
    app.use("*", cors())

    const response = await app.fetch(
      new Request("https://api.example/auth/me", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "GET",
        },
      }),
      { CORS_ALLOWLIST: "http://localhost:3000" },
    )

    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("filters requested preflight headers", async () => {
    const app = new Hono<{ Bindings: VoyantBindings }>()
    app.use("*", cors())

    const response = await app.fetch(
      new Request("https://api.example/auth/me", {
        method: "OPTIONS",
        headers: {
          origin: "https://dashboard.example",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type, cookie, x-voyant-checkout-capability",
        },
      }),
      { CORS_ALLOWLIST: "https://dashboard.example" },
    )

    expect(response.headers.get("access-control-allow-headers")).toBe(
      "content-type, x-voyant-checkout-capability",
    )
  })
})
