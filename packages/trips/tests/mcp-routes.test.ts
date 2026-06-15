// @vitest-environment node

import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import type { McpToolContext } from "../src/mcp-contract.js"
import { createTripMcpRoutes } from "../src/mcp-routes.js"
import type { TripsMcpServices } from "../src/mcp-tools.js"

function stubServices(): TripsMcpServices {
  return {
    createTrip: async () => ({ envelope: { id: "trip_test" }, components: [] }) as never,
    addComponent: async () => ({ id: "comp_test" }) as never,
    removeComponent: async () => null,
    priceTrip: async () => ({}) as never,
    reserveTrip: async () => ({}) as never,
  }
}

function buildRoutes() {
  return createTripMcpRoutes({
    buildContext: (): McpToolContext => ({
      actor: "staff",
      tenantId: "tenant_test",
      defaultScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    }),
    buildTripsServices: () => stubServices(),
  })
}

describe("trips MCP routes", () => {
  it("does not expose trips tools on the public surface", async () => {
    const app = new Hono()
    app.route("/v1/admin/mcp", buildRoutes())

    const response = await app.request("/v1/public/mcp/tools/create_trip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(404)
  })

  it("does not expose retired catalog tools", async () => {
    const app = new Hono()
    app.route("/v1/admin/mcp", buildRoutes())

    const response = await app.request("/v1/admin/mcp/tools/search_catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    // The tool is not registered → dispatcher returns a structured NOT_FOUND result (200).
    expect(response.status).toBe(200)
    const body = (await response.json()) as { structuredContent?: { error?: { code?: string } } }
    expect(body.structuredContent?.error?.code).toBe("NOT_FOUND")
  })

  it("dispatches trips tools on the admin surface", async () => {
    const app = new Hono()
    app.route("/v1/admin/mcp", buildRoutes())

    const response = await app.request("/v1/admin/mcp/tools/create_trip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Test trip",
        travelerParty: {},
        components: [],
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      isError?: boolean
      structuredContent?: { error?: { code?: string }; envelope?: { id?: string } }
    }
    expect(body.structuredContent?.error?.code).not.toBe("NOT_FOUND")
    expect(body.structuredContent?.envelope?.id).toBe("trip_test")
  })
})
