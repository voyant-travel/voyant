import { createRoute, OpenAPIHono, z as openApiZod } from "@hono/zod-openapi"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { handleApiError, requestId } from "../../src/middleware/error-boundary.js"
import { openApiValidationHook } from "../../src/openapi-validation.js"
import { RequestValidationError } from "../../src/validation.js"

/**
 * Guards the validation-error contract for `.openapi()` routes (voyant#2114):
 * a failed request-schema parse must surface as the framework's
 * `RequestValidationError` (status 400, `code: "invalid_request"`) — the same
 * shape `parseQuery`/`parseJsonBody` produce — not `@hono/zod-validator`'s raw
 * `safeParse` output.
 */
describe("openApiValidationHook", () => {
  const parsed = z.object({ limit: z.number() }).safeParse({ limit: "nope" })

  it("throws a framework RequestValidationError on a failed parse", () => {
    expect(parsed.success).toBe(false)
    let thrown: unknown
    try {
      openApiValidationHook({ target: "query", ...parsed }, undefined as never)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RequestValidationError)
    expect((thrown as RequestValidationError).status).toBe(400)
    expect((thrown as RequestValidationError).code).toBe("invalid_request")
  })

  it("is a no-op when validation succeeds", () => {
    expect(() =>
      openApiValidationHook(
        { target: "query", success: true, data: { limit: 1 } },
        undefined as never,
      ),
    ).not.toThrow()
  })
})

/**
 * End-to-end guard for the systemic regression behind voyant#2114: a JSON-body
 * `.openapi()` route installs Hono's request validator, which throws
 * `HTTPException(400, "Malformed JSON in request body")` for malformed client
 * JSON *before* `openApiValidationHook` runs. The shared error boundary must map
 * that onto the framework contract (status 400, `code: "invalid_request"`)
 * instead of falling through to a bare 500.
 */
describe("malformed JSON on an .openapi() body route", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a structured 400 through the shared error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const app = new OpenAPIHono({ defaultHook: openApiValidationHook })
    app.onError(handleApiError)
    app.use("*", requestId)
    app.openapi(
      createRoute({
        method: "post",
        path: "/leads",
        request: {
          body: {
            required: true,
            content: {
              "application/json": {
                schema: openApiZod.object({ name: openApiZod.string().min(2) }),
              },
            },
          },
        },
        responses: {
          200: {
            description: "ok",
            content: {
              "application/json": { schema: openApiZod.object({ name: openApiZod.string() }) },
            },
          },
        },
      }),
      (c) => c.json({ name: c.req.valid("json").name }),
    )

    const response = await app.request("http://example.com/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "invalid_request" })
  })
})

/**
 * Regression guard for the systemic partial-PATCH silent no-op (voyant#2114,
 * §16). Hono's `json` validator supplies `{}` instead of parsing when the
 * request omits (or mis-declares) the `application/json` content-type. A
 * `.partial()` PATCH schema considers `{}` valid, so without the content-type
 * gate the handler would run with an empty patch and silently drop the caller's
 * changes (200, no-op). `openApiValidationHook` must turn a missing/incorrect
 * content-type into a clean `invalid_request` 400 for declared JSON bodies.
 */
describe("content-type enforcement for .openapi() json bodies", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makePatchApp() {
    const app = new OpenAPIHono({ defaultHook: openApiValidationHook })
    app.onError(handleApiError)
    app.use("*", requestId)
    app.openapi(
      createRoute({
        method: "patch",
        path: "/widgets/{id}",
        request: {
          params: openApiZod.object({ id: openApiZod.string() }),
          body: {
            required: true,
            content: {
              "application/json": {
                schema: openApiZod.object({ name: openApiZod.string().min(2) }).partial(),
              },
            },
          },
        },
        responses: {
          200: {
            description: "ok",
            content: {
              "application/json": {
                schema: openApiZod.object({ name: openApiZod.string().optional() }),
              },
            },
          },
        },
      }),
      (c) => c.json({ name: c.req.valid("json").name }),
    )
    return app
  }

  it("returns a 400 invalid_request for a partial PATCH body sent without a content-type", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await makePatchApp().request("http://example.com/widgets/w_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "renamed" }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "invalid_request" })
  })

  it("accepts a partial PATCH body with application/json", async () => {
    const response = await makePatchApp().request("http://example.com/widgets/w_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "renamed" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ name: "renamed" })
  })

  it("accepts application/json with a charset parameter", async () => {
    const response = await makePatchApp().request("http://example.com/widgets/w_1", {
      method: "PATCH",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ name: "renamed" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ name: "renamed" })
  })

  it("rejects a non-json content-type for a declared json body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await makePatchApp().request("http://example.com/widgets/w_1", {
      method: "PATCH",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ name: "renamed" }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "invalid_request" })
  })

  // The guard must MATCH Hono's parser acceptance exactly: content-types Hono
  // leaves unparsed (it is case-sensitive and rejects a bare trailing `;`) must
  // 400 here, not slip through as a silent no-op patch.
  it.each(["Application/JSON", "application/json;"])(
    "rejects %j, which Hono's json parser does not accept",
    async (contentType) => {
      vi.spyOn(console, "error").mockImplementation(() => {})

      const response = await makePatchApp().request("http://example.com/widgets/w_1", {
        method: "PATCH",
        headers: { "content-type": contentType },
        body: JSON.stringify({ name: "renamed" }),
      })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: "invalid_request" })
    },
  )
})
