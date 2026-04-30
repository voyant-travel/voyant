/**
 * Catalog bridge — wires product CRUD events into the search indexer so
 * Typesense stays in sync with the operator's product table without manual
 * `pnpm reindex` runs.
 *
 * Subscribes to `product.created`, `product.updated`, `product.deleted`
 * (emitted by `@voyantjs/products` route handlers) and:
 *   - reindexes the entity across `DEFAULT_SLICES` on create/update,
 *   - deletes from every configured slice on delete.
 *
 * If Typesense isn't configured (no `TYPESENSE_HOST`), every handler is a
 * no-op — so dev environments without search infra are silent rather than
 * noisy.
 */

import type { HonoBundle } from "@voyantjs/hono/plugin"
import { createProductDocumentBuilder } from "@voyantjs/products/service-catalog-plane"
import { createIndexerService } from "@voyantjs/voyant-catalog"
import {
  buildEmbeddingProvider,
  buildTypesenseIndexer,
  DEFAULT_SLICES,
  getFieldPolicyRegistries,
  withEmbedding,
} from "./lib/catalog-runtime"
import { getDbFromHyperdrive } from "./lib/db"

interface ProductEventPayload {
  id: string
}

export const catalogBridgeBundle: HonoBundle = {
  name: "catalog-bridge",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as CloudflareBindings & {
      TENANT_ID?: string
      TYPESENSE_HOST?: string
      TYPESENSE_ADMIN_API_KEY?: string
      TYPESENSE_API_KEY?: string
      VOYANT_CLOUD_API_KEY?: string
    }
    const sellerOperatorId = env.TENANT_ID ?? "default"

    function buildContext() {
      const embeddings = buildEmbeddingProvider(env)
      const indexer = buildTypesenseIndexer(env, embeddings)
      if (!indexer) return null
      const slices = [...DEFAULT_SLICES]
      const service = createIndexerService({
        adapter: indexer,
        slices,
        registries: getFieldPolicyRegistries(),
      })
      const db = getDbFromHyperdrive(env)
      const builder = withEmbedding(
        createProductDocumentBuilder(db, { sellerOperatorId }),
        embeddings,
      )
      return { service, builder }
    }

    eventBus.subscribe<ProductEventPayload>("product.created", async ({ data }) => {
      const ctx = buildContext()
      if (!ctx) return
      await ctx.service.ensureCollections()
      await ctx.service.reindexEntity("products", data.id, ctx.builder)
    })

    eventBus.subscribe<ProductEventPayload>("product.updated", async ({ data }) => {
      const ctx = buildContext()
      if (!ctx) return
      await ctx.service.reindexEntity("products", data.id, ctx.builder)
    })

    eventBus.subscribe<ProductEventPayload>("product.deleted", async ({ data }) => {
      const ctx = buildContext()
      if (!ctx) return
      await ctx.service.deleteEntity("products", data.id)
    })
  },
}
