/**
 * Trips agent tool surface (transport: HTTP).
 *
 * A generic tool-dispatch route owned by the trips package. It registers the
 * trips command tools (create / revise / price / reserve) and dispatches a
 * `POST /tools/:tool` call against them.
 *
 * The deployment supplies the per-request `McpToolContext` and the
 * `TripsMcpServices` (which bind the trips service to the deployment's db +
 * dependency wiring) via `options`. Mount the returned router at
 * `/v1/admin/mcp`.
 */
import { type Context, Hono } from "hono"

import type { McpToolContext } from "./mcp-contract.js"
import { createMcpToolRegistry } from "./mcp-registry.js"
import {
  createTripTool,
  priceTripTool,
  reserveTripTool,
  reviseTripTool,
  type TripsMcpServices,
} from "./mcp-tools.js"

export interface TripMcpRoutesOptions {
  /**
   * Build the per-request MCP tool context (actor / tenant / default scope).
   * Derived from the request's auth + the deployment's defaults.
   */
  buildContext(c: Context): McpToolContext
  /**
   * Build the trips MCP services for this request — binds the trips service to
   * the deployment's db + dependency wiring.
   */
  buildTripsServices(c: Context): TripsMcpServices
}

function registerAdminTools(registry: ReturnType<typeof createMcpToolRegistry>): void {
  registry.register(createTripTool)
  registry.register(reviseTripTool)
  registry.register(priceTripTool)
  registry.register(reserveTripTool)
}

/** Build the trips MCP admin routes (relative paths; mount at `/v1/admin/mcp`). */
export function createTripMcpRoutes(options: TripMcpRoutesOptions): Hono {
  async function handle(c: Context) {
    const tool = c.req.param("tool")
    if (!tool) return c.json({ error: "Missing tool name" }, 400)

    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      body = {}
    }

    const registry = createMcpToolRegistry({
      context: {
        ...options.buildContext(c),
        trips: options.buildTripsServices(c),
      } as McpToolContext & { trips: TripsMcpServices },
    })
    registerAdminTools(registry)
    const result = await registry.dispatchTool(tool, body)
    return c.json(result)
  }

  const routes = new Hono()
  routes.post("/tools/:tool", handle)
  return routes
}
