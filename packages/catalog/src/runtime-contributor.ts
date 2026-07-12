import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { CatalogSearchRuntimeOptions } from "./api-runtime-ports.js"
import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "./api-runtime-ports.js"
import {
  createOwnedBookingHandlerRegistry,
  createSourceAdapterRegistry,
} from "./booking-engine/index.js"
import type { CatalogBookingRouteModuleOptions } from "./booking-engine/operator-routes.js"
import { type CatalogContentRuntime, catalogContentRuntimePort } from "./content-runtime-port.js"
import type { CatalogOffersRouteModuleOptions } from "./offers/operator-routes.js"
import {
  buildCatalogEmbeddingProvider,
  buildCatalogTypesenseIndexer,
  type CatalogNodeRuntimeEnv,
} from "./operator-runtime.js"
import {
  type CatalogBookingSnapshotRuntimeProvider,
  type CatalogProjectionRuntimeProvider,
  catalogBookingSnapshotRuntimePort,
  catalogProjectionRuntimePort,
} from "./subscriber-runtime-ports.js"

type RuntimePortValue<T> = T | Promise<T>

export interface CatalogRuntimePortContribution {
  search: RuntimePortValue<CatalogSearchRuntimeOptions>
  booking: RuntimePortValue<CatalogBookingRouteModuleOptions>
  offers: RuntimePortValue<CatalogOffersRouteModuleOptions>
  content: RuntimePortValue<CatalogContentRuntime>
  projection: RuntimePortValue<CatalogProjectionRuntimeProvider>
  bookingSnapshot: RuntimePortValue<CatalogBookingSnapshotRuntimeProvider>
}

export interface CatalogRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned Catalog defaults lowered from the generic runtime host. */
export function createCatalogRuntimePortContribution(
  host: CatalogRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const sourceRegistry = createSourceAdapterRegistry()
  const ownedHandlers = createOwnedBookingHandlerRegistry()
  const contribution = Promise.resolve<CatalogRuntimePortContribution>({
    search: {
      resolveRuntime: (context) => {
        const requestContext = context as { env?: unknown; var?: { actor?: string } }
        const env = host.primitives.env(requestContext.env) as CatalogNodeRuntimeEnv
        const embeddings = buildCatalogEmbeddingProvider(env)
        return {
          indexer: buildCatalogTypesenseIndexer(env, { embeddings }),
          embeddings,
          defaultScope: {
            locale: "en-GB",
            audience: requestContext.var?.actor === "staff" ? "staff" : "public",
            market: "default",
          },
        }
      },
    },
    booking: {
      booking: {
        resolveDb: (context) => host.primitives.database.fromContext(context),
        resolveSourceRegistry: () => sourceRegistry,
        resolveOwnedHandlers: () => ownedHandlers,
      },
      resolveRegistry: () => sourceRegistry,
      getProductContent: async () => null,
      listAvailabilitySlots: async () => [],
      getOwnedProductById: async () => null,
    },
    offers: {
      resolveConnectClient: () => null,
      fetchIndexFields: async () => new Map(),
      resolveDynamicHotelIds: async () => [],
      resolveAirportLabels: async (_context, codes) => codes.map((code) => ({ code, label: code })),
    },
    content: { resolveRegistry: () => sourceRegistry },
    projection: {
      createRuntime: () => ({
        reindexEntity: async () => undefined,
        deleteEntity: async () => undefined,
      }),
    },
    bookingSnapshot: {
      createRuntime: (bindings) => ({
        withContext: (operation) =>
          host.primitives.database.transaction(bindings, (database) =>
            operation({
              db: database as AnyDrizzleDb,
              sellerOperatorId: String(host.primitives.config.read(bindings, "OPERATOR_ID") ?? ""),
              findBookingProductIds: async () => [],
              buildSnapshotInput: async () => null,
            }),
          ),
      }),
    },
  })
  return {
    [catalogSearchRuntimePort.id]: contribution.then((runtime) => runtime.search),
    [catalogBookingRuntimePort.id]: contribution.then((runtime) => runtime.booking),
    [catalogOffersRuntimePort.id]: contribution.then((runtime) => runtime.offers),
    [catalogContentRuntimePort.id]: contribution.then((runtime) => runtime.content),
    [catalogProjectionRuntimePort.id]: contribution.then((runtime) => runtime.projection),
    [catalogBookingSnapshotRuntimePort.id]: contribution.then((runtime) => runtime.bookingSnapshot),
  }
}
