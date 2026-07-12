import { defineToolContextContribution, requireService, ToolError } from "@voyant-travel/tools"
import { executeSemanticSearch } from "./search/semantic.js"
import type { CatalogToolServices } from "./tools.js"

type CatalogMcpResource = {
  catalog: {
    indexer?: Parameters<typeof executeSemanticSearch>[0]["adapter"]
    embeddings?: Parameters<typeof executeSemanticSearch>[0]["embeddings"]
    resolveEntity?: (
      vertical: string,
      id: string,
      scope: Parameters<CatalogToolServices["getEntry"]>[0]["scope"],
    ) => Promise<{
      vertical: string
      entityId: string
      fields: Record<string, unknown>
      provenance?: Record<string, { locale: string; audience: string; market: string } | null>
    } | null>
  }
}

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["catalog"],
  contribute: ({ resources }) => {
    const resource = requireService(
      resources.catalog as CatalogMcpResource | undefined,
      "catalog MCP resource",
    )
    const catalog: CatalogToolServices = {
      async search({ slice, request }) {
        const indexer = resource.catalog.indexer
        if (!indexer) {
          throw new ToolError(
            "Catalog search indexer is not configured for this deployment.",
            "PROVIDER_ERROR",
          )
        }
        if (request.mode === "keyword") return indexer.search(slice, request)
        try {
          return await executeSemanticSearch({
            adapter: indexer,
            embeddings: resource.catalog.embeddings,
            slice,
            request,
          })
        } catch {
          return indexer.search(slice, {
            ...request,
            mode: "keyword",
            query_embedding: undefined,
            query_embedding_model_id: undefined,
          })
        }
      },
      async getEntry({ vertical, id, scope }) {
        const entry = await resource.catalog.resolveEntity?.(vertical, id, scope)
        return entry
          ? {
              vertical: entry.vertical,
              id: entry.entityId,
              fields: entry.fields,
              provenance: entry.provenance,
            }
          : null
      },
    }
    return { catalog }
  },
})
