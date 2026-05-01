import type { SearchFilter, SearchMode, SearchRequest } from "@voyantjs/catalog"
import {
  checkAvailabilityTool,
  createMcpToolRegistry,
  getEntityTool,
  getQuoteTool,
  type McpResolvedEntity,
  type McpToolContext,
  searchCatalogTool,
  suggestAlternativesTool,
} from "@voyantjs/catalog-mcp"
import { executeSemanticSearch } from "@voyantjs/catalog-rag"
import { getResolvedExtraById } from "@voyantjs/extras/service-catalog-plane"
import { getResolvedProductById } from "@voyantjs/products/service-catalog-plane"
import type { Context, Hono } from "hono"

import { buildEmbeddingProvider, buildTypesenseIndexer } from "./lib/catalog-runtime"

function registerAllTools(registry: ReturnType<typeof createMcpToolRegistry>): void {
  registry.register(searchCatalogTool)
  registry.register(getEntityTool)
  registry.register(suggestAlternativesTool)
  registry.register(checkAvailabilityTool)
  registry.register(getQuoteTool)
}

function buildToolContext(c: Context): McpToolContext {
  const env = c.env as CloudflareBindings & {
    VOYANT_CLOUD_API_KEY?: string
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

  const embeddings = buildEmbeddingProvider(env)
  const indexer = buildTypesenseIndexer(env, embeddings)

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

interface CatalogSearchBody {
  vertical?: string
  query?: string
  mode?: SearchMode
  filters?: SearchFilter[]
  facets?: Array<{ field: string }>
  pagination?: { limit?: number; cursor?: string }
  alpha?: number
  distance_threshold?: number
  query_embedding?: number[]
  /** Optional explicit market override; defaults to defaultScope.market. */
  market?: string
  /** Optional explicit locale override; defaults to defaultScope.locale. */
  locale?: string
}

/**
 * Plain-JSON catalog search route — what admin UIs call directly.
 * Same `IndexerService` plumbing as the MCP `search_catalog` tool, but
 * the response shape is `{ vertical, mode, total, hits, facets }` instead
 * of the MCP `{ isError, content, structuredContent }` envelope.
 *
 * Authorization: actor pinned by createApp's auth middleware. Audience
 * comes from actor (staff → staff slice; customer → customer slice).
 * Cross-audience federation isn't surfaced here — admins doing federated
 * search go through the MCP route.
 */
export function mountCatalogSearchRoutes(hono: Hono): void {
  async function handle(c: Context) {
    let body: CatalogSearchBody
    try {
      body = await c.req.json<CatalogSearchBody>()
    } catch {
      body = {}
    }

    if (!body.vertical) return c.json({ error: "vertical is required" }, 400)

    const ctx = buildToolContext(c)
    const indexer = ctx.catalog.indexer
    if (!indexer) {
      return c.json({ error: "Search indexer is not configured (missing TYPESENSE_HOST)" }, 503)
    }

    const mode = body.mode ?? "keyword"
    if ((mode === "semantic" || mode === "hybrid") && !ctx.catalog.embeddings) {
      return c.json(
        { error: "Embeddings provider is not configured for semantic / hybrid mode" },
        503,
      )
    }

    const slice = {
      vertical: body.vertical,
      locale: body.locale ?? ctx.defaultScope.locale,
      audience: ctx.defaultScope.audience,
      market: body.market ?? ctx.defaultScope.market,
    }

    const request: SearchRequest = {
      query: body.query ?? "",
      mode,
      filters: body.filters,
      facets: body.facets,
      pagination: body.pagination,
      alpha: body.alpha,
      distance_threshold: body.distance_threshold,
      query_embedding: body.query_embedding,
    }

    try {
      const results = await executeSemanticSearch({
        adapter: indexer,
        embeddings: ctx.catalog.embeddings,
        slice,
        request,
      })
      return c.json({
        vertical: body.vertical,
        mode,
        total: results.total,
        hits: results.hits,
        facets: results.facets ?? {},
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  }

  hono.post("/v1/admin/catalog/search", handle)
}
