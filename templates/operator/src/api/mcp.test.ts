// @vitest-environment node

import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { mountCatalogMcpRoutes } from "./mcp"

function testBindings(
  bindings: Partial<CloudflareBindings> & { TENANT_ID?: string },
): CloudflareBindings {
  return bindings as never
}

const testEnv = testBindings({ TENANT_ID: "tenant_test" })

describe("operator MCP routes", () => {
  it("does not expose travel-composer mutation tools on the public surface", async () => {
    const app = new Hono()
    mountCatalogMcpRoutes(app)

    const response = await app.request(
      "/v1/public/mcp/tools/create_trip",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Tool is not available on the public MCP surface",
    })
  })

  it("does not expose quote-locking tools on the public surface", async () => {
    const app = new Hono()
    mountCatalogMcpRoutes(app)

    const response = await app.request(
      "/v1/public/mcp/tools/get_quote",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    )

    expect(response.status).toBe(403)
  })

  it("keeps read-only catalog tools available on the public surface", async () => {
    const app = new Hono()
    mountCatalogMcpRoutes(app)

    const response = await app.request(
      "/v1/public/mcp/tools/search_catalog",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { structuredContent?: { error?: { code?: string } } }
    expect(body.structuredContent?.error?.code).not.toBe("NOT_FOUND")
    expect(body.structuredContent?.error?.code).not.toBe("FORBIDDEN")
  })

  it("keeps the full registry available on the admin surface", async () => {
    const app = new Hono()
    mountCatalogMcpRoutes(app)

    const response = await app.request(
      "/v1/admin/mcp/tools/create_trip",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { structuredContent?: { error?: { code?: string } } }
    expect(body.structuredContent?.error?.code).not.toBe("NOT_FOUND")
    expect(body.structuredContent?.error?.code).not.toBe("FORBIDDEN")
  })
})
