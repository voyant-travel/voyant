import { getResolvedExtraById } from "@voyantjs/extras/service-catalog-plane"
import { getResolvedRoomTypeById } from "@voyantjs/hospitality/service-catalog-plane"
import { getResolvedProductById } from "@voyantjs/products/service-catalog-plane"
import {
  checkAvailabilityTool,
  createMcpToolRegistry,
  getEntityTool,
  getQuoteTool,
  type McpResolvedEntity,
  type McpToolContext,
  searchCatalogTool,
  suggestAlternativesTool,
} from "@voyantjs/voyant-catalog-mcp"
import { createOpenAIEmbeddingProvider } from "@voyantjs/voyant-catalog-rag"
import type { Context, Hono } from "hono"

import { buildTypesenseIndexer } from "./lib/catalog-runtime"

function registerAllTools(registry: ReturnType<typeof createMcpToolRegistry>): void {
  registry.register(searchCatalogTool)
  registry.register(getEntityTool)
  registry.register(suggestAlternativesTool)
  registry.register(checkAvailabilityTool)
  registry.register(getQuoteTool)
}

function buildToolContext(c: Context): McpToolContext {
  const env = c.env as CloudflareBindings & {
    OPENAI_API_KEY?: string
    TENANT_ID?: string
    TYPESENSE_HOST?: string
    TYPESENSE_ADMIN_API_KEY?: string
    TYPESENSE_API_KEY?: string
  }
  const db = c.var.db
  const actor = (c.var.actor ?? "staff") as McpToolContext["actor"]
  const audience: McpToolContext["defaultScope"]["audience"] = actor === "staff" ? "staff" : actor
  const locale = c.req.header("accept-language")?.split(",")[0]?.trim() || "en-GB"
  const tenantId = env.TENANT_ID ?? "default"
  const sellerOperatorId = tenantId

  const embeddings = env.OPENAI_API_KEY
    ? createOpenAIEmbeddingProvider({ apiKey: env.OPENAI_API_KEY })
    : undefined

  const indexer = buildTypesenseIndexer(env)

  return {
    actor,
    tenantId,
    defaultScope: { locale, audience, market: "default", actor },
    catalog: {
      embeddings,
      indexer,
      async resolveEntity(vertical, entityId): Promise<McpResolvedEntity | null> {
        const ctx = {
          sellerOperatorId,
          scope: { locale, audience, market: "default", actor },
        }
        let view: Awaited<ReturnType<typeof getResolvedProductById>> | null = null
        if (vertical === "products") view = await getResolvedProductById(db, entityId, ctx)
        else if (vertical === "extras") view = await getResolvedExtraById(db, entityId, ctx)
        else if (vertical === "hospitality") view = await getResolvedRoomTypeById(db, entityId, ctx)
        else return null
        if (!view) return null
        const fields: Record<string, unknown> = {}
        for (const [path, value] of view.values) {
          fields[path] = value
        }
        return { vertical, entityId, fields }
      },
    },
  }
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
    const ctx = buildToolContext(c)
    const registry = createMcpToolRegistry({ context: ctx })
    registerAllTools(registry)
    const result = await registry.dispatchTool(tool, body)
    return c.json(result)
  }

  hono.post("/v1/admin/mcp/tools/:tool", handle)
  hono.post("/v1/public/mcp/tools/:tool", handle)
}
