import { validateEmbeddingCompatibility } from "@voyant-travel/catalog/embeddings/model-registry"
import { type CatalogIndexer, resolveCatalogIndexer } from "@voyant-travel/catalog/indexer/provider"
import type { CatalogSearchRuntime } from "@voyant-travel/catalog/search/routes"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { FinanceOperatorSettingsRuntime } from "@voyant-travel/finance/runtime-port"
import {
  ensureBookingEngineRegistry,
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistry,
  getOwnedBookingHandlerRegistryFromContext,
} from "./runtime/booking-engine-runtime.js"
import {
  applyOperatorTaxToQuoteResult,
  createOperatorCatalogBookingRouteModuleOptions,
} from "./runtime/booking-runtime.js"
import {
  buildEmbeddingProvider,
  createProductsDocumentBuilder,
  DEFAULT_SLICES,
  getFieldPolicyRegistries,
  loadCatalogSlices,
  withEmbedding,
  withoutCatalogScopeChannel,
} from "./runtime/catalog-runtime.js"
import { configureCatalogRuntimeHost } from "./runtime/host.js"
import { createOperatorCatalogOffersRouteModuleOptions } from "./runtime/offers-runtime.js"
import {
  createOperatorCatalogBookingSnapshotRuntime,
  createOperatorCatalogProjectionRuntime,
} from "./runtime/subscriber-runtime.js"
import {
  type CatalogRuntimeExtensions,
  type CatalogRuntimeServices,
  installCatalogRuntimeServices,
} from "./runtime-contracts.js"
import type { CatalogRuntimePortContribution } from "./runtime-contributor.js"

/** Build the complete Catalog runtime from generic host resources. */
export function createCatalogRuntime(
  primitives: VoyantRuntimeHostPrimitives,
  extensions: CatalogRuntimeExtensions,
  settings: FinanceOperatorSettingsRuntime,
  options: { indexer?: CatalogIndexer } = {},
): CatalogRuntimePortContribution {
  configureCatalogRuntimeHost(primitives, extensions)
  let indexer: ReturnType<typeof resolveCatalogIndexer> | undefined
  let vectorDimensions: number | null | undefined
  const resolveIndexer = (embeddings: ReturnType<typeof buildEmbeddingProvider>) => {
    if (options.indexer === undefined) return undefined
    const nextVectorDimensions = embeddings?.capabilities.dimensions ?? null
    if (indexer && vectorDimensions !== nextVectorDimensions) {
      throw new Error(
        `Catalog indexer was initialized with ${vectorDimensions ?? "no"} vector dimensions and cannot be recreated with ${nextVectorDimensions ?? "no"}.`,
      )
    }
    if (!indexer) {
      const adapter = resolveCatalogIndexer(options.indexer, {
        vectorDimensions: nextVectorDimensions,
        registries: getFieldPolicyRegistries(),
      })
      if (embeddings) {
        validateEmbeddingCompatibility(embeddings.capabilities, adapter.capabilities)
      }
      vectorDimensions = nextVectorDimensions
      indexer = adapter
    }
    return indexer
  }
  let projectionRuntime:
    | ReturnType<typeof createOperatorCatalogProjectionRuntime>
    | Promise<ReturnType<typeof createOperatorCatalogProjectionRuntime>>
    | undefined
  const services: CatalogRuntimeServices = {
    defaultSlices: DEFAULT_SLICES,
    ensureSourceRegistry: (env) => ensureBookingEngineRegistry(env as never),
    getSourceRegistryFromContext: (context) =>
      getBookingEngineRegistryFromContext(context as never),
    getOwnedHandlers: (env) => getOwnedBookingHandlerRegistry(env as never),
    getOwnedHandlersFromContext: (context) =>
      getOwnedBookingHandlerRegistryFromContext(context as never),
    buildEmbeddingProvider: (env) => buildEmbeddingProvider(env as never),
    buildIndexer: (_env, embeddings) => resolveIndexer(embeddings),
    loadSlices: loadCatalogSlices,
    fieldPolicyRegistries: getFieldPolicyRegistries,
    createProductsDocumentBuilder,
    withEmbedding,
    applyTaxToQuoteResult: (db, result, entityModule, entityId, sourceKind) =>
      applyOperatorTaxToQuoteResult(
        db,
        result,
        entityModule,
        entityId,
        sourceKind,
        settings.resolveBookingTaxSettings,
      ),
  }
  installCatalogRuntimeServices(services)
  return {
    search: {
      resolveRuntime: (context) => createCatalogSearchRuntime(context, resolveIndexer),
    },
    booking: createOperatorCatalogBookingRouteModuleOptions(),
    offers: createOperatorCatalogOffersRouteModuleOptions(
      (context) => withoutCatalogScopeChannel(resolveCatalogDefaultScope(context)),
      (context) => {
        const env = context.env as Record<string, unknown>
        return resolveIndexer(buildEmbeddingProvider(env as never))
      },
    ),
    content: { resolveRegistry: getBookingEngineRegistryFromContext },
    projection: {
      createRuntime(bindings) {
        projectionRuntime ??= createOperatorCatalogProjectionRuntime(bindings, services)
        return projectionRuntime
      },
    },
    bookingSnapshot: { createRuntime: createOperatorCatalogBookingSnapshotRuntime },
    services,
  }
}

function createCatalogSearchRuntime(
  context: unknown,
  resolveIndexer: (
    embeddings: ReturnType<typeof buildEmbeddingProvider>,
  ) => ReturnType<typeof resolveCatalogIndexer> | undefined,
): CatalogSearchRuntime {
  const env = (context as { env: Record<string, unknown> }).env
  const embeddings = buildEmbeddingProvider(env)
  const defaultScope = resolveCatalogDefaultScope(context)
  return {
    indexer: resolveIndexer(embeddings),
    embeddings,
    defaultScope,
  }
}

function resolveCatalogDefaultScope(context: unknown): CatalogSearchRuntime["defaultScope"] {
  const requestContext = context as { env: Record<string, unknown>; var?: { actor?: string } }
  const env = requestContext.env
  const actor = requestContext.var?.actor ?? "staff"
  const audience: CatalogSearchRuntime["defaultScope"]["audience"] =
    actor === "staff" ? "staff" : (actor as CatalogSearchRuntime["defaultScope"]["audience"])
  return {
    locale: stringValue(env.DEFAULT_LOCALE) ?? "en-GB",
    audience,
    market: stringValue(env.DEFAULT_MARKET) ?? "default",
    channel: stringValue(env.VOYANT_STOREFRONT_CHANNEL_ID),
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}
