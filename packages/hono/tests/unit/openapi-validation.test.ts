import { describe, expect, it } from "vitest"
import { z } from "zod"

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
