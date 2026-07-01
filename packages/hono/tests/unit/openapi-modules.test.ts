import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import { generateModuleOpenApiDocuments, type ModuleMount } from "../../src/openapi.js"

const INFO = { title: "Test", version: "0.0.0" } as const

/** Build a tiny OpenAPIHono sub-app exposing one documented GET at `path`. */
function docApp(path: string): OpenAPIHono {
  const app = new OpenAPIHono()
  app.openapi(
    createRoute({
      method: "get",
      path,
      responses: {
        200: {
          description: "ok",
          content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
        },
      },
    }),
    (c) => c.json({ ok: true }),
  )
  return app
}

describe("generateModuleOpenApiDocuments", () => {
  it("groups mounts by module name and prefixes paths at their real mount", async () => {
    const mounts: ModuleMount[] = [
      { moduleName: "bookings", prefix: "/v1/admin/bookings", load: () => docApp("/") },
      { moduleName: "bookings", prefix: "/v1/public/bookings", load: () => docApp("/quote") },
      { moduleName: "finance", prefix: "/v1/admin/finance", load: () => docApp("/invoices") },
    ]

    const docs = await generateModuleOpenApiDocuments(mounts, { info: INFO })

    expect([...docs.keys()].sort()).toEqual(["bookings", "finance"])
    // A module doc spans both surfaces, at real absolute paths.
    expect(Object.keys(docs.get("bookings")?.paths ?? {}).sort()).toEqual([
      "/v1/admin/bookings",
      "/v1/public/bookings/quote",
    ])
    expect(Object.keys(docs.get("finance")?.paths ?? {})).toEqual(["/v1/admin/finance/invoices"])
  })

  it("honors publicPath overrides whose prefix isn't the module name", async () => {
    const mounts: ModuleMount[] = [
      { moduleName: "commerce", prefix: "/v1/public/booking-engine", load: () => docApp("/hold") },
    ]

    const docs = await generateModuleOpenApiDocuments(mounts, { info: INFO })

    // File would be commerce.json, but the path keeps the real booking-engine mount.
    expect(Object.keys(docs.get("commerce")?.paths ?? {})).toEqual([
      "/v1/public/booking-engine/hold",
    ])
  })

  it("skips plain Hono sub-apps and loaders that throw, without failing the module", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const mounts: ModuleMount[] = [
      // Plain Hono → no `.openapi()` registry → contributes nothing.
      { moduleName: "plain", prefix: "/v1/admin/plain", load: () => new Hono() },
      // Throwing loader → skipped with a warning.
      {
        moduleName: "broken",
        prefix: "/v1/admin/broken",
        load: () => {
          throw new Error("boom")
        },
      },
      { moduleName: "ok", prefix: "/v1/admin/ok", load: () => docApp("/ping") },
    ]

    const docs = await generateModuleOpenApiDocuments(mounts, { info: INFO })

    // Only the module that produced a documented operation survives.
    expect([...docs.keys()]).toEqual(["ok"])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it("awaits async (lazy) loaders", async () => {
    const mounts: ModuleMount[] = [
      {
        moduleName: "flights",
        prefix: "/v1/admin/flights",
        load: async () => docApp("/search"),
      },
    ]

    const docs = await generateModuleOpenApiDocuments(mounts, { info: INFO })

    expect(Object.keys(docs.get("flights")?.paths ?? {})).toEqual(["/v1/admin/flights/search"])
  })
})
