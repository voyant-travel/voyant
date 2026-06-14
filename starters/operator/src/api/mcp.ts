/**
 * Operator agent tool surface.
 *
 * Catalog MCP wrappers are retired; catalog-capable agents call the catalog
 * HTTP APIs directly. This route keeps only the admin trips commands.
 */

import {
  createMcpToolRegistry,
  createTripTool,
  type McpToolContext,
  priceTripTool,
  reserveTripTool,
  reviseTripTool,
  type TripsMcpServices,
  tripsService,
} from "@voyant-travel/trips"
import type { Context, Hono } from "hono"

import { DEFAULT_SLICES } from "./lib/catalog-runtime"
import { createOperatorTripsRoutesOptions } from "./trips-runtime"

function registerAdminTools(registry: ReturnType<typeof createMcpToolRegistry>): void {
  registry.register(createTripTool)
  registry.register(reviseTripTool)
  registry.register(priceTripTool)
  registry.register(reserveTripTool)
}

export function mountOperatorAgentToolRoutes(hono: Hono): void {
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
        ...buildToolContext(c),
        trips: createTripsMcpServices(c),
      } as McpToolContext & { trips: TripsMcpServices },
    })
    registerAdminTools(registry)
    const result = await registry.dispatchTool(tool, body)
    return c.json(result)
  }

  hono.post("/v1/admin/mcp/tools/:tool", handle)
}

function buildToolContext(c: Context): McpToolContext {
  const env = c.env as CloudflareBindings & { TENANT_ID?: string }
  const actor = (c.var.actor ?? "staff") as McpToolContext["actor"]
  const audience: McpToolContext["defaultScope"]["audience"] = actor === "staff" ? "staff" : actor
  const locale = DEFAULT_SLICES[0]?.locale ?? "en-GB"
  return {
    actor,
    tenantId: env.TENANT_ID ?? "default",
    defaultScope: { locale, audience, market: "default", actor },
  }
}

function createTripsMcpServices(c: Context): TripsMcpServices {
  const options = createOperatorTripsRoutesOptions()
  return {
    createTrip: (input) => tripsService.createTrip(c.var.db, input),
    addComponent: (input) => tripsService.addComponent(c.var.db, input),
    removeComponent: (componentId) => tripsService.removeComponent(c.var.db, componentId),
    priceTrip: (input) => {
      const deps = resolveDeps(c, options.priceTripDeps)
      if (!deps) throw new Error("Trips price dependencies are not configured")
      return tripsService.priceTrip(c.var.db, input, deps)
    },
    reserveTrip: (input) => {
      const deps = resolveDeps(c, options.reserveTripDeps)
      if (!deps) throw new Error("Trips reserve dependencies are not configured")
      return tripsService.reserveTrip(c.var.db, input, deps)
    },
  }
}

function resolveDeps<T>(c: Context, deps: T | ((c: Context) => T | undefined) | undefined) {
  if (typeof deps !== "function") return deps
  return (deps as (c: Context) => T | undefined)(c)
}
