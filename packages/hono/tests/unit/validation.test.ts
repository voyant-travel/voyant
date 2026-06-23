import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { requireUserId } from "../../src/auth/require-user.js"
import { handleApiError, requestId } from "../../src/middleware/error-boundary.js"
import {
  ApiHttpError,
  normalizeValidationError,
  parseJsonBody,
  parseQuery,
} from "../../src/validation.js"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("validation helpers", () => {
  it("returns a structured 400 for invalid query parameters", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const app = new Hono()
    app.onError(handleApiError)
    app.use("*", requestId)
    app.get("/search", (c) => {
      const query = parseQuery(c, z.object({ limit: z.coerce.number().int().positive() }))
      return c.json({ limit: query.limit })
    })

    const response = await app.request("http://example.com/search?limit=nope")
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "Invalid input: expected number, received NaN",
      code: "invalid_request",
      details: {
        fields: {
          fieldErrors: {
            limit: expect.any(Array),
          },
          formErrors: [],
        },
      },
    })
  })

  it("returns a structured 400 for invalid JSON bodies", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const app = new Hono()
    app.onError(handleApiError)
    app.use("*", requestId)
    app.post("/search", async (c) => {
      const body = await parseJsonBody(c, z.object({ name: z.string().min(2) }))
      return c.json({ name: body.name })
    })

    const response = await app.request("http://example.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid-json",
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "Invalid JSON body",
      code: "invalid_request",
    })
  })

  it("returns a structured 401 when a route requires a user id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const app = new Hono()
    app.onError(handleApiError)
    app.use("*", requestId)
    app.get("/me", (c) => {
      const userId = requireUserId(c)
      return c.json({ userId })
    })

    const response = await app.request("http://example.com/me")
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: "Unauthorized",
      code: "unauthorized",
    })
  })
})

describe("normalizeValidationError", () => {
  it("maps a Hono HTTPException 400 onto the framework error contract", () => {
    // Hono's request validators (e.g. the JSON body parser on `.openapi()`
    // routes) throw HTTPException before our validation hook runs (voyant#2114).
    const normalized = normalizeValidationError(
      new HTTPException(400, { message: "Malformed JSON in request body" }),
    )
    expect(normalized).toBeInstanceOf(ApiHttpError)
    expect(normalized?.status).toBe(400)
    expect(normalized?.code).toBe("invalid_request")
    expect(normalized?.message).toBe("Malformed JSON in request body")
  })

  it("preserves non-400 HTTPException status without an invalid_request code", () => {
    const normalized = normalizeValidationError(new HTTPException(404, { message: "Not Found" }))
    expect(normalized).toBeInstanceOf(ApiHttpError)
    expect(normalized?.status).toBe(404)
    expect(normalized?.code).toBeUndefined()
  })
})
