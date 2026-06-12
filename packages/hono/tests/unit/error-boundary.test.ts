import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { handleApiError } from "../../src/middleware/error-boundary.js"
import { RequestValidationError } from "../../src/validation.js"

describe("handleApiError", () => {
  it("does not reflect generic thrown status messages or details", async () => {
    const app = new Hono()
    app.onError(handleApiError)
    app.get("/bad", () => {
      throw Object.assign(new Error("database hostname leaked"), {
        status: 400,
        details: { secret: "x" },
      })
    })

    const response = await app.request("/bad")
    const body = (await response.json()) as { error: string; details?: unknown }

    expect(response.status).toBe(500)
    expect(body.error).toBe("Internal Server Error")
    expect(body.details).toBeUndefined()
  })

  it("still reflects framework validation errors", async () => {
    const app = new Hono()
    app.onError(handleApiError)
    app.get("/bad", () => {
      throw new RequestValidationError("Invalid input", { fields: { name: ["Required"] } })
    })

    const response = await app.request("/bad")
    const body = (await response.json()) as { error: string; details?: unknown }

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid input")
    expect(body.details).toEqual({ fields: { name: ["Required"] } })
  })
})
