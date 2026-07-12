import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { CatalogRuntimePortContribution } from "./runtime-contributor.js"
import type { CatalogSearchRuntime } from "./search/routes.js"
import { getBookingEngineRegistryFromContext } from "./standard-node/booking-engine-runtime.js"
import { createOperatorCatalogBookingRouteModuleOptions } from "./standard-node/booking-runtime.js"
import { buildEmbeddingProvider, buildTypesenseIndexer } from "./standard-node/catalog-runtime.js"
import { configureCatalogStandardNodeHost } from "./standard-node/host.js"
import { createOperatorCatalogOffersRouteModuleOptions } from "./standard-node/offers-runtime.js"
import {
  createOperatorCatalogBookingSnapshotRuntime,
  createOperatorCatalogProjectionRuntime,
} from "./standard-node/subscriber-runtime.js"

/** Build the complete standard Node Catalog runtime from generic host resources. */
export function createCatalogStandardNodeRuntime(
  primitives: VoyantRuntimeHostPrimitives,
): CatalogRuntimePortContribution {
  configureCatalogStandardNodeHost(primitives)
  let projectionRuntime:
    | ReturnType<typeof createOperatorCatalogProjectionRuntime>
    | Promise<ReturnType<typeof createOperatorCatalogProjectionRuntime>>
    | undefined
  return {
    search: { resolveRuntime: createCatalogSearchRuntime },
    booking: createOperatorCatalogBookingRouteModuleOptions(),
    offers: createOperatorCatalogOffersRouteModuleOptions(),
    content: { resolveRegistry: getBookingEngineRegistryFromContext },
    projection: {
      createRuntime(bindings) {
        projectionRuntime ??= createOperatorCatalogProjectionRuntime(bindings)
        return projectionRuntime
      },
    },
    bookingSnapshot: { createRuntime: createOperatorCatalogBookingSnapshotRuntime },
  }
}

function createCatalogSearchRuntime(context: unknown): CatalogSearchRuntime {
  const requestContext = context as { env: Record<string, unknown>; var?: { actor?: string } }
  const env = requestContext.env
  const embeddings = buildEmbeddingProvider(env)
  const actor = requestContext.var?.actor ?? "staff"
  const audience: CatalogSearchRuntime["defaultScope"]["audience"] =
    actor === "staff" ? "staff" : (actor as CatalogSearchRuntime["defaultScope"]["audience"])
  return {
    indexer: buildTypesenseIndexer(env, embeddings),
    embeddings,
    defaultScope: {
      locale: "en-GB",
      audience,
      market: "default",
      channel:
        typeof env.VOYANT_STOREFRONT_CHANNEL_ID === "string"
          ? env.VOYANT_STOREFRONT_CHANNEL_ID
          : undefined,
    },
  }
}
