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
