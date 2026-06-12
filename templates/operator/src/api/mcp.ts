/**
 * MCP (Model Context Protocol) tool surface — `/v1/admin/mcp/tools/:tool`
 * and `/v1/public/mcp/tools/:tool`. Used by AI agents and external MCP
 * clients to invoke catalog tools (search, resolve entity, suggest
 * alternatives, check availability, get quote).
 *
 * Plain-JSON catalog search for admin UIs is provided by `@voyantjs/catalog`.
 */

import {
  checkAvailabilityTool,
  createMcpToolRegistry,
  getEntityTool,
  getQuoteTool,
  searchCatalogTool,
  suggestAlternativesTool,
} from "@voyantjs/catalog-mcp"
import {
  createTripTool,
  priceTripTool,
  reserveTripTool,
  reviseTripTool,
  type TravelComposerMcpServices,
  travelComposerService,
} from "@voyantjs/travel-composer"
import type { Context, Hono } from "hono"

import { buildCatalogContext } from "./lib/catalog-context"
import { createOperatorTravelComposerRoutesOptions } from "./travel-composer-runtime"

const PUBLIC_MCP_TOOL_NAMES = new Set([
  searchCatalogTool.name,
  getEntityTool.name,
  suggestAlternativesTool.name,
  checkAvailabilityTool.name,
])

function registerPublicTools(registry: ReturnType<typeof createMcpToolRegistry>): void {
  registry.register(searchCatalogTool)
  registry.register(getEntityTool)
  registry.register(suggestAlternativesTool)
  registry.register(checkAvailabilityTool)
}

function registerAllTools(registry: ReturnType<typeof createMcpToolRegistry>): void {
  registerPublicTools(registry)
  registry.register(getQuoteTool)
  registry.register(createTripTool)
  registry.register(reviseTripTool)
  registry.register(priceTripTool)
  registry.register(reserveTripTool)
}

export function mountCatalogMcpRoutes(hono: Hono): void {
  async function handle(c: Context, surface: "admin" | "public") {
    const tool = c.req.param("tool")
    if (!tool) return c.json({ error: "Missing tool name" }, 400)
    if (surface === "public" && !PUBLIC_MCP_TOOL_NAMES.has(tool)) {
      return c.json({ error: "Tool is not available on the public MCP surface" }, 403)
    }
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      body = {}
    }
    const ctx = {
      ...buildCatalogContext(c),
      travelComposer: createTravelComposerMcpServices(c),
    }
    const registry = createMcpToolRegistry({ context: ctx })
    if (surface === "admin") registerAllTools(registry)
    else registerPublicTools(registry)
    const result = await registry.dispatchTool(tool, body)
    return c.json(result)
  }

  hono.post("/v1/admin/mcp/tools/:tool", (c) => handle(c, "admin"))
  hono.post("/v1/public/mcp/tools/:tool", (c) => handle(c, "public"))
}

function createTravelComposerMcpServices(c: Context): TravelComposerMcpServices {
  const options = createOperatorTravelComposerRoutesOptions()
  return {
    createTrip: (input) => travelComposerService.createTrip(c.var.db, input),
    addComponent: (input) => travelComposerService.addComponent(c.var.db, input),
    removeComponent: (componentId) => travelComposerService.removeComponent(c.var.db, componentId),
    priceTrip: (input) => {
      const deps = resolveDeps(c, options.priceTripDeps)
      if (!deps) throw new Error("Travel composer price dependencies are not configured")
      return travelComposerService.priceTrip(c.var.db, input, deps)
    },
    reserveTrip: (input) => {
      const deps = resolveDeps(c, options.reserveTripDeps)
      if (!deps) throw new Error("Travel composer reserve dependencies are not configured")
      return travelComposerService.reserveTrip(c.var.db, input, deps)
    },
  }
}

function resolveDeps<T>(c: Context, deps: T | ((c: Context) => T | undefined) | undefined) {
  if (typeof deps !== "function") return deps
  return (deps as (c: Context) => T | undefined)(c)
}
