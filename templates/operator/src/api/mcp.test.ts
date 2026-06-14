// @vitest-environment node

import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { mountOperatorAgentToolRoutes } from "./mcp"

function testBindings(
  bindings: Partial<CloudflareBindings> & { TENANT_ID?: string },
): CloudflareBindings {
  return bindings as never
}

const testEnv = testBindings({ TENANT_ID: "tenant_test" })

describe("operator MCP routes", () => {
  it("does not expose trip-composer mutation tools on the public surface", async () => {
    const app = new Hono()
    mountOperatorAgentToolRoutes(app)

    const response = await app.request(
      "/v1/public/mcp/tools/create_trip",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    )

    expect(response.status).toBe(404)
  })

  it("does not expose quote-locking tools on the public surface", async () => {
    const app = new Hono()
    mountOperatorAgentToolRoutes(app)

    const response = await app.request(
      "/v1/public/mcp/tools/get_quote",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    )

    expect(response.status).toBe(404)
  })

  it("does not expose retired catalog MCP tools on the public surface", async () => {
    const app = new Hono()
    mountOperatorAgentToolRoutes(app)

    const response = await app.request(
      "/v1/public/mcp/tools/search_catalog",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    )

    expect(response.status).toBe(404)
  })

  it("keeps trip-composer tools available on the admin surface", async () => {
    const app = new Hono()
    mountOperatorAgentToolRoutes(app)

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
