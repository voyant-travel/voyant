/**
 * Plain-JSON catalog search route — what admin UIs call directly.
 *
 * Distinct from the MCP surface (`./mcp.ts`): same underlying indexer
 * plumbing but a flat `{ vertical, mode, total, hits, facets }` response
 * shape instead of the MCP `{ isError, content, structuredContent }`
 * envelope. Authorization is whatever `createApp`'s auth middleware pinned
 * for this request; audience is derived from actor (staff → staff slice;
 * customer → customer slice). Cross-audience federation isn't surfaced
 * here — admins doing federated search go through the MCP route.
 */

import type { SearchFilter, SearchMode, SearchRequest } from "@voyantjs/catalog"
import { executeSemanticSearch } from "@voyantjs/catalog-rag"
import type { Context, Hono } from "hono"

import { buildCatalogContext } from "./lib/catalog-context"

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

export function mountCatalogSearchRoutes(hono: Hono): void {
  async function handle(c: Context) {
    let body: CatalogSearchBody
    try {
      body = await c.req.json<CatalogSearchBody>()
    } catch {
      body = {}
    }

    if (!body.vertical) return c.json({ error: "vertical is required" }, 400)

    const ctx = buildCatalogContext(c)
    const indexer = ctx.catalog.indexer
    if (!indexer) {
      return c.json({ error: "Search indexer is not configured (missing TYPESENSE_HOST)" }, 503)
    }

    // Default to hybrid (best results when embeddings are configured) and
    // silently downgrade to keyword when they aren't — admins searching the
    // catalog get the best mode their deployment supports without having to
    // pick. No 503 here; an unconfigured embeddings provider is a deployment
    // posture, not a per-request error.
    const requestedMode = body.mode ?? "hybrid"
    const mode =
      (requestedMode === "semantic" || requestedMode === "hybrid") && !ctx.catalog.embeddings
        ? "keyword"
        : requestedMode

    // Audience tracks the route surface — admin mount stays as the
    // template's default (typically "staff"); public mount switches
    // to "customer" so visibility / overlay scoping resolves the
    // customer-facing projection.
    const isPublic = c.req.path.startsWith("/v1/public/")
    const audience = isPublic ? "customer" : ctx.defaultScope.audience
    const slice = {
      vertical: body.vertical,
      locale: body.locale ?? ctx.defaultScope.locale,
      audience,
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
  // Public surface for the storefront. The publicPaths entry in
  // app.ts stamps `actor: "customer"`; the audience swap above
  // narrows the slice scope to the customer projection.
  hono.post("/v1/public/catalog/search", handle)
}
