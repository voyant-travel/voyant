import { defineToolContextContribution, requireService, ToolError } from "@voyant-travel/tools"
import type { Context } from "hono"

import { type CatalogSearchRuntimeOptions, catalogSearchRuntimePort } from "./api-runtime-ports.js"
import { executeSemanticSearch } from "./search/semantic.js"
import type { CatalogToolServices } from "./tools.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["catalog"],
  async contribute({ request, resources }) {
    const provider = await Promise.resolve(
      requireService(
        resources[catalogSearchRuntimePort.id] as
          | CatalogSearchRuntimeOptions
          | Promise<CatalogSearchRuntimeOptions>
          | undefined,
        catalogSearchRuntimePort.id,
      ),
    )
    catalogSearchRuntimePort.test(provider)
    const runtime = provider.resolveRuntime(request as Context)
    const catalog: CatalogToolServices = {
      async search({ slice, request }) {
        const indexer = runtime.indexer
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
            embeddings: runtime.embeddings as Parameters<
              typeof executeSemanticSearch
            >[0]["embeddings"],
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
      async getEntry() {
        return null
      },
    }
    return { catalog }
  },
})
