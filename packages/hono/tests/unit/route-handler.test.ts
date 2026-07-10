import { Hono } from "hono"
import { describe, expect, expectTypeOf, it } from "vitest"

import type { VoyantBindings, VoyantRouteHandler, VoyantVariables } from "../../src/types.js"

describe("VoyantRouteHandler", () => {
  it("uses Voyant bindings and preserves request variables", async () => {
    const handler: VoyantRouteHandler = (c) =>
      c.json({ databaseUrl: c.env.DATABASE_URL, requestId: c.get("requestId") })

    expectTypeOf(handler).toMatchTypeOf<
      VoyantRouteHandler<VoyantBindings & { FEATURE_FLAG?: string }>
    >()

    const app = new Hono<{ Bindings: VoyantBindings; Variables: VoyantVariables }>()
    app.use("*", async (c, next) => {
      c.set("requestId", "request-123")
      await next()
    })
    app.get("/", handler)

    const response = await app.request("/", undefined, { DATABASE_URL: "postgres://test" })
    await expect(response.json()).resolves.toEqual({
      databaseUrl: "postgres://test",
      requestId: "request-123",
    })
  })
})
