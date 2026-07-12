import { bookingItems } from "@voyant-travel/bookings/schema"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { buildProductSnapshotInput } from "@voyant-travel/inventory/service-catalog-plane"
import { and, eq, isNotNull } from "drizzle-orm"
import type {
  CatalogBookingSnapshotExecutionContext,
  CatalogBookingSnapshotRuntime,
} from "../booking-snapshot-subscriber-runtime.js"
import {
  createCatalogBookingSnapshotRuntimeAdapter,
  createCatalogProjectionRuntimeAdapter,
} from "../operator-runtime.js"
import type { CatalogProjectionRuntime } from "../projection-runtime.js"

import {
  buildEmbeddingProvider,
  buildTypesenseIndexer,
  createProductsDocumentBuilder,
  getFieldPolicyRegistries,
  loadCatalogSlices,
  withEmbedding,
} from "./catalog-runtime.js"
import { catalogStandardNodeHost } from "./host.js"

type CatalogSubscriberBindings = Record<string, unknown> & {
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
  return createCatalogProjectionRuntimeAdapter({
    bindings: env,
    withDb: (bindings, operation) =>
      catalogStandardNodeHost().database.transaction(bindings, (database) =>
        operation(database as AnyDrizzleDb),
      ),
    buildContext: async (db) => {
      const embeddings = buildEmbeddingProvider(env)
      const adapter = buildTypesenseIndexer(env, embeddings)
      if (!adapter) return null
      return {
        adapter,
        slices: await loadCatalogSlices(db),
        registries: getFieldPolicyRegistries(),
        builder: withEmbedding(createProductsDocumentBuilder(db, { sellerOperatorId }), embeddings),
      }
    },
  })
}

export function createOperatorCatalogBookingSnapshotRuntime(
  bindings: unknown,
): CatalogBookingSnapshotRuntime {
  const env = bindings as CatalogSubscriberBindings

  return createCatalogBookingSnapshotRuntimeAdapter({
    bindings: env,
    withDb: (bindings, operation) =>
      catalogStandardNodeHost().database.transaction(bindings, (database) =>
        operation(database as AnyDrizzleDb),
      ),
    buildContext: async (db) => {
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
      return context
    },
  })
}
