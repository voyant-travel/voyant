/**
 * Per-request catalog context builder shared by both the AI/MCP surface
 * (`mountCatalogMcpRoutes`) and the plain-JSON admin search surface
 * (`mountCatalogSearchRoutes`). The shape is `McpToolContext` because that
 * type already covers everything either caller needs (actor, defaultScope,
 * catalog.indexer/embeddings/resolveEntity) — it's reused, not adopted from
 * MCP semantically.
 */

import type { McpResolvedEntity, McpToolContext } from "@voyantjs/catalog-mcp"
import { getResolvedExtraById } from "@voyantjs/extras/service-catalog-plane"
import { getResolvedProductById } from "@voyantjs/products/service-catalog-plane"
import type { Context } from "hono"

import { buildEmbeddingProvider, buildTypesenseIndexer, DEFAULT_SLICES } from "./catalog-runtime"

export function buildCatalogContext(c: Context): McpToolContext {
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
  // Default locale to the first indexed slice, NOT the browser's
  // `accept-language`. The operator only indexes `DEFAULT_SLICES`
  // (en-GB by default), so a Chrome-on-en-US user would otherwise hit
  // a non-existent `products__en-US__staff__default` collection. Callers
  // can still override via the request body's `locale` field.
  const locale = DEFAULT_SLICES[0]?.locale ?? "en-GB"
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
