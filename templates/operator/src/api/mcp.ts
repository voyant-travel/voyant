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
import type { Context, Hono } from "hono"

import { buildCatalogContext } from "./lib/catalog-context"

function registerAllTools(registry: ReturnType<typeof createMcpToolRegistry>): void {
  registry.register(searchCatalogTool)
  registry.register(getEntityTool)
  registry.register(suggestAlternativesTool)
  registry.register(checkAvailabilityTool)
  registry.register(getQuoteTool)
}

export function mountCatalogMcpRoutes(hono: Hono): void {
  async function handle(c: Context) {
    const tool = c.req.param("tool")
    if (!tool) return c.json({ error: "Missing tool name" }, 400)
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      body = {}
    }
    const ctx = buildCatalogContext(c)
    const registry = createMcpToolRegistry({ context: ctx })
    registerAllTools(registry)
    const result = await registry.dispatchTool(tool, body)
    return c.json(result)
  }

  hono.post("/v1/admin/mcp/tools/:tool", handle)
  hono.post("/v1/public/mcp/tools/:tool", handle)
}
