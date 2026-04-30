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
  buildTypesenseIndexer,
  DEFAULT_SLICES,
  getFieldPolicyRegistries,
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
    }
    const sellerOperatorId = env.TENANT_ID ?? "default"

    function buildService() {
      const indexer = buildTypesenseIndexer(env)
      if (!indexer) return null
      const slices = [...DEFAULT_SLICES]
      return createIndexerService({
        adapter: indexer,
        slices,
        registries: getFieldPolicyRegistries(),
      })
    }

    eventBus.subscribe<ProductEventPayload>("product.created", async ({ data }) => {
      const service = buildService()
      if (!service) return
      const db = getDbFromHyperdrive(env)
      const builder = createProductDocumentBuilder(db, { sellerOperatorId })
      await service.ensureCollections()
      await service.reindexEntity("products", data.id, builder)
    })

    eventBus.subscribe<ProductEventPayload>("product.updated", async ({ data }) => {
      const service = buildService()
      if (!service) return
      const db = getDbFromHyperdrive(env)
      const builder = createProductDocumentBuilder(db, { sellerOperatorId })
      await service.reindexEntity("products", data.id, builder)
    })

    eventBus.subscribe<ProductEventPayload>("product.deleted", async ({ data }) => {
      const service = buildService()
      if (!service) return
      await service.deleteEntity("products", data.id)
    })
  },
}
