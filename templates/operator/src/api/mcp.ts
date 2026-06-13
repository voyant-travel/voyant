/**
 * Operator agent tool surface.
 *
 * Catalog MCP wrappers are retired; catalog-capable agents call the catalog
 * HTTP APIs directly. This route keeps only the admin trip-composer commands.
 */

import {
  createMcpToolRegistry,
  createTripTool,
  type McpToolContext,
  priceTripTool,
  reserveTripTool,
  reviseTripTool,
  type TripComposerMcpServices,
  tripComposerService,
} from "@voyantjs/trip-composer"
import type { Context, Hono } from "hono"

import { DEFAULT_SLICES } from "./lib/catalog-runtime"
import { createOperatorTripComposerRoutesOptions } from "./trip-composer-runtime"

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
        tripComposer: createTripComposerMcpServices(c),
      } as McpToolContext & { tripComposer: TripComposerMcpServices },
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

function createTripComposerMcpServices(c: Context): TripComposerMcpServices {
  const options = createOperatorTripComposerRoutesOptions()
  return {
    createTrip: (input) => tripComposerService.createTrip(c.var.db, input),
    addComponent: (input) => tripComposerService.addComponent(c.var.db, input),
    removeComponent: (componentId) => tripComposerService.removeComponent(c.var.db, componentId),
    priceTrip: (input) => {
      const deps = resolveDeps(c, options.priceTripDeps)
      if (!deps) throw new Error("Trip composer price dependencies are not configured")
      return tripComposerService.priceTrip(c.var.db, input, deps)
    },
    reserveTrip: (input) => {
      const deps = resolveDeps(c, options.reserveTripDeps)
      if (!deps) throw new Error("Trip composer reserve dependencies are not configured")
      return tripComposerService.reserveTrip(c.var.db, input, deps)
    },
  }
}

function resolveDeps<T>(c: Context, deps: T | ((c: Context) => T | undefined) | undefined) {
  if (typeof deps !== "function") return deps
  return (deps as (c: Context) => T | undefined)(c)
}
