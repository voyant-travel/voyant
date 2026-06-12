import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { securityHeaders } from "../../src/middleware/security-headers.js"

describe("securityHeaders middleware", () => {
  it("sets default hardening headers", async () => {
    const app = new Hono()
    app.use("*", securityHeaders())
    app.get("/ok", (c) => c.json({ ok: true }))

    const response = await app.request("https://api.example/ok")

    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
    expect(response.headers.get("x-frame-options")).toBe("DENY")
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'")
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000")
  })
})
