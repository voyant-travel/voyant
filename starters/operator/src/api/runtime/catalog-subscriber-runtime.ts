import { bookingItems } from "@voyant-travel/bookings/schema"
import { createIndexerService } from "@voyant-travel/catalog"
import type {
  CatalogBookingSnapshotExecutionContext,
  CatalogBookingSnapshotRuntime,
} from "@voyant-travel/catalog/booking-snapshot-subscriber"
import {
  type CatalogProjectionRuntime,
  createEnsureCatalogCollectionsSerializer,
} from "@voyant-travel/catalog/projection-runtime"
import { buildProductSnapshotInput } from "@voyant-travel/inventory/service-catalog-plane"
import { and, eq, isNotNull } from "drizzle-orm"

import {
  buildEmbeddingProvider,
  buildTypesenseIndexer,
  createProductsDocumentBuilder,
  getFieldPolicyRegistries,
  loadCatalogSlices,
  withEmbedding,
} from "../lib/catalog-runtime"
import { withDbFromEnv } from "../lib/db"

type CatalogSubscriberBindings = AppBindings & {
  TENANT_ID?: string
  TYPESENSE_HOST?: string
  TYPESENSE_ADMIN_API_KEY?: string
  TYPESENSE_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
}

export function createOperatorCatalogProjectionRuntime(
  bindings: unknown,
): CatalogProjectionRuntime {
  const env = bindings as CatalogSubscriberBindings
  const sellerOperatorId = env.TENANT_ID ?? "default"
  const ensureCollections = createEnsureCatalogCollectionsSerializer()

  async function withIndexer(
    operation: (context: Awaited<ReturnType<typeof buildIndexerContext>> & object) => Promise<void>,
  ) {
    await withDbFromEnv(env, async (db) => {
      const context = await buildIndexerContext(db)
      if (!context) return
      await operation(context)
    })
  }

  async function buildIndexerContext(db: Parameters<typeof createProductsDocumentBuilder>[0]) {
    const embeddings = buildEmbeddingProvider(env)
    const indexer = buildTypesenseIndexer(env, embeddings)
    if (!indexer) return null
    const service = createIndexerService({
      adapter: indexer,
      slices: await loadCatalogSlices(db),
      registries: getFieldPolicyRegistries(),
    })
    const builder = withEmbedding(
      createProductsDocumentBuilder(db, { sellerOperatorId }),
      embeddings,
    )
    return { service, builder }
  }

  return {
    reindexEntity: ({ entityModule, entityId }) =>
      withIndexer(async ({ service, builder }) => {
        await ensureCollections(() => service.ensureCollections())
        await service.reindexEntity(entityModule, entityId, builder)
      }),
    deleteEntity: ({ entityModule, entityId }) =>
      withIndexer(async ({ service }) => {
        await service.deleteEntity(entityModule, entityId)
      }),
  }
}

export function createOperatorCatalogBookingSnapshotRuntime(
  bindings: unknown,
): CatalogBookingSnapshotRuntime {
  const env = bindings as CatalogSubscriberBindings

  return {
    withContext: (operation) =>
      withDbFromEnv(env, async (db) => {
        const sellerOperatorId = env.TENANT_ID ?? "default"
        const context: CatalogBookingSnapshotExecutionContext = {
          db,
          sellerOperatorId,
          findBookingProductIds: async (bookingId) => {
            const items = await db
              .select({ productId: bookingItems.productId })
              .from(bookingItems)
              .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(bookingItems.productId)))
            return items.map(({ productId }) => productId)
          },
          buildSnapshotInput: (productId, options) =>
            buildProductSnapshotInput(db, productId, options),
        }
        return operation(context)
      }),
  }
}
