/**
 * Graph-driven runtime composition for the operator starter.
 *
 * agent-quality: file-size exception -- this is the deployment's single
 * composition source of truth (one factory entry per mounted module/extension,
 * now that every route family composes here instead of ad-hoc additionalRoutes).
 * Keeping the manifest + registry + capabilities in one file is intentional; the
 * length scales with the module count, not with logic complexity.
 *
 * Generated package loaders own selection and order. This file keeps only the
 * deployment capability container and the ID-keyed bindings that configure
 * option-bearing factories or supply deployment-local units.
 */

import { OpenAPIHono } from "@hono/zod-openapi"
import type {
  CatalogSearchRuntime,
  EmbeddingProvider,
  IndexerAdapter,
} from "@voyant-travel/catalog"
import type { CheckoutNotificationDelivery } from "@voyant-travel/finance/checkout"
import type { CheckoutReminderRunRecord } from "@voyant-travel/finance/checkout-validation"
import { flightsRuntimePort } from "@voyant-travel/flights"
import {
  extensionsFromGlob,
  type FrameworkProviders,
  frameworkComposition,
  type VoyantGraphRuntimeBindingContext,
  type VoyantGraphRuntimeBindings,
  type VoyantGraphRuntimePorts,
} from "@voyant-travel/framework"
import { lazyProvider } from "@voyant-travel/hono"
import type { ExtensionFactory, ModuleFactory } from "@voyant-travel/hono/composition"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"
import { legalRuntimePort } from "@voyant-travel/legal"
import {
  type LegalBookingContractSubscriberRuntime,
  legalBookingContractSubscriberRuntimePort,
} from "@voyant-travel/legal/booking-contract-subscriber"
import { notificationsRuntimePort } from "@voyant-travel/notifications"
import type { SmartbillPluginOptions } from "@voyant-travel/plugin-smartbill"
import { realtimeRuntimePort } from "@voyant-travel/realtime"
import { relationshipsRouteRuntimePort } from "@voyant-travel/relationships/voyant"
import { storageMediaRuntimePort } from "@voyant-travel/storage/routes"
import type { StorefrontIntakePersistence } from "@voyant-travel/storefront"
import {
  TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY,
  type TripsPaymentSubscriberRuntime,
} from "@voyant-travel/trips/payment-subscribers"
import { resolveOperatorCustomFields } from "../lib/custom-fields"
import { resolveNotificationProviders } from "../lib/notifications"
import { operatorRealtimeBridgeRoutes, resolveRealtimeProviders } from "../lib/realtime"
import { resolveBookingRequirementsProductSnapshot } from "./lib/booking-requirements-product-snapshot"
import { withDbFromEnv } from "./lib/db"
import { createChannelPushExtension } from "./routes/channel-push"
import { AUTO_GENERATE_CONTRACT_OPTIONS } from "./runtime/contract-document-variables"
import { createOperatorNotificationsRuntimeProvider } from "./runtime/notifications-runtime"
import {
  createOperatorBookingPiiService,
  createOperatorDocumentStorage,
  createOperatorInvoiceExchangeRateResolver,
  createOperatorInvoiceSettlementPollers,
  operatorPostgresDb,
  readOperatorDocumentContentBase64,
  resolveOperatorContractDocumentGenerator,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./runtime/operator-runtime-adapter"
import {
  registerBookingsWorkflowService,
  registerDistributionWorkflowService,
  registerInventoryWorkflowService,
} from "./runtime/operator-workflow-services"
import {
  resolveBankTransferDetails,
  resolvePublicCheckoutBaseUrlFromBindings,
} from "./runtime/payment-config"
import { recordPaidBookingCancellationSettlement } from "./subscribers/booking-cancellation-settlement"
import { closeTerminalBookingPaymentSchedules } from "./subscribers/booking-payment-cleanup"

type AsyncMethodProvider<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never
}

/**
 * The operator deployment's capability container. Every template-specific
 * resolver/service a module factory needs is gathered here so wiring lives in
 * one typed place rather than being threaded through `createApp`.
 */
// `extends FrameworkProviders` is the compile-time guard that this container
// satisfies the framework's injected provider contract (so the relocated
// `frameworkComposition` factories can read it). A future framework provider
// addition becomes required here, failing the operator typecheck until
// `buildOperatorProviders` wires it — that's the intended forcing function.
export interface OperatorCapabilities extends FrameworkProviders {
  resolveNotificationProviders: typeof resolveNotificationProviders
  resolvePublicCheckoutBaseUrl: typeof resolvePublicCheckoutBaseUrlFromBindings
  resolveDocumentDownloadUrl: typeof resolveOperatorDocumentDownloadUrl
  readDocumentContentBase64: typeof readOperatorDocumentContentBase64
  resolveDb: typeof resolveOperatorDb
  createOperatorDocumentStorage: typeof createOperatorDocumentStorage
  resolveBankTransferDetails: typeof resolveBankTransferDetails
  relationshipsService: FrameworkProviders["relationshipsService"]
  closePaymentSchedulesForBooking: typeof closeTerminalBookingPaymentSchedules
  recordCancellationFinancialSettlement: typeof recordPaidBookingCancellationSettlement
  createTripsRoutesOptions: FrameworkProviders["createTripsRoutesOptions"]
  resolveBookingRequirementsProductSnapshot: typeof resolveBookingRequirementsProductSnapshot
  createChannelPushExtension: typeof createChannelPushExtension
}

/**
 * Build the operator provider container (gathers deployment resolvers/loaders).
 * Providers are bindings-deferred closures, so no `env` is needed here.
 */
export function buildOperatorProviders(): OperatorCapabilities {
  return {
    customFields: resolveOperatorCustomFields,
    resolveNotificationProviders,
    resolvePublicCheckoutBaseUrl: resolvePublicCheckoutBaseUrlFromBindings,
    resolveDocumentDownloadUrl: resolveOperatorDocumentDownloadUrl,
    readDocumentContentBase64: readOperatorDocumentContentBase64,
    resolveDb: resolveOperatorDb,
    withDb: (bindings, operation) => withDbFromEnv(bindings as AppBindings, operation),
    createOperatorDocumentStorage,
    createInvoiceExchangeRateResolver: createOperatorInvoiceExchangeRateResolver,
    createInvoiceSettlementPollers: createOperatorInvoiceSettlementPollers,
    resolveContractDocumentGenerator: resolveOperatorContractDocumentGenerator,
    createBookingPiiService: createOperatorBookingPiiService,
    autoGenerateContractOnConfirmed: AUTO_GENERATE_CONTRACT_OPTIONS,
    resolveBankTransferDetails,
    relationshipsService: lazyProvider<FrameworkProviders["relationshipsService"]>(async () =>
      import("@voyant-travel/relationships").then(
        (m) =>
          m.relationshipsService as AsyncMethodProvider<FrameworkProviders["relationshipsService"]>,
      ),
    ),
    closePaymentSchedulesForBooking: closeTerminalBookingPaymentSchedules,
    recordCancellationFinancialSettlement: recordPaidBookingCancellationSettlement,
    // Adapt the deployment's catalog context into the package's search runtime
    // shape (the framework catalog factory consumes this directly).
    resolveCatalogRuntime: createLazyCatalogSearchRuntime,
    createTripsRoutesOptions: () =>
      import("./runtime/trips-runtime").then((m) => m.createOperatorTripsRoutesOptions()),
    resolveBookingRequirementsProductSnapshot,
    storefrontIntakePersistence: lazyProvider<StorefrontIntakePersistence>(async () =>
      import("./runtime/storefront-intake-runtime").then(
        (m) =>
          m.createRelationshipsStorefrontIntakePersistence() as AsyncMethodProvider<StorefrontIntakePersistence>,
      ),
    ),
    resolvePaymentStarters: () => ({
      netopia: lazyProvider(async () =>
        import("@voyant-travel/plugin-netopia").then((m) => m.createNetopiaCheckoutStarter()),
      ),
    }),
    createChannelPushExtension,
    // Lazy route-bundle loaders for the `operator/*` standard families — each
    // wires this deployment's providers into the package-owned route bundle.
    loadMcpAdminRoutes: () => import("./runtime/mcp-runtime").then((m) => m.buildMcpAdminRoutes()),
    loadCatalogBookingRoutes: () =>
      import("./runtime/catalog-booking-runtime").then((m) => {
        // OpenAPIHono parent so the booking-engine sub-apps' `.openapi()` defs
        // (quote/book/drafts/holds) surface in the operator spec via the
        // build-time lazy-merge — `mergeLazyOpenApiPaths` skips plain `Hono`
        // wrappers, which carry no registry (voyant#2114 / voyant#2208). The
        // mount accepts a `Pick<Hono, "route" | "get">`, so the OpenAPIHono is
        // passed without a cast despite its non-blank default `Env`.
        const app = new OpenAPIHono()
        m.mountCatalogBookingRoutes(app)
        return app
      }),
    loadInventoryContentRoutes: () =>
      import("./routes/catalog-content").then((m) => {
        // OpenAPIHono parent so the product content sub-app's `.openapi()` def
        // (`GET /{id}/content`) surfaces in the operator spec via the build-time
        // lazy-merge — `mergeLazyOpenApiPaths` skips plain `Hono` wrappers, which
        // carry no registry (voyant#2114). The cruise/accommodation content
        // factories are still plain `Hono`, so only the product content routes
        // are documented for now.
        const app = new OpenAPIHono()
        m.mountInventoryContentRoutes(app)
        return app
      }),
    loadCruisesContentRoutes: () =>
      import("./routes/catalog-content").then((m) => {
        const app = new OpenAPIHono()
        m.mountCruisesContentRoutes(app)
        return app
      }),
    loadAccommodationsContentRoutes: () =>
      import("./routes/catalog-content").then((m) => {
        const app = new OpenAPIHono()
        m.mountAccommodationsContentRoutes(app)
        return app
      }),
    loadInventoryBrochureRoutes: () =>
      import("./runtime/media-runtime").then((m) => m.buildOperatorInventoryBrochureRoutes()),
    loadPaymentLinkRoutes: () =>
      import("./runtime/payment-link-runtime").then((m) => m.buildOperatorPaymentLinkRoutes()),
    loadContractDocumentRoutes: () =>
      import("./runtime/contract-document-runtime").then((m) => m.buildContractDocumentRoutes()),
    // Lazy `operator/*` standard extension builders/loaders.
    createBookingScheduleRoutesOptions: () =>
      import("./routes/booking-schedule").then((m) => m.createBookingScheduleRoutesOptions()),
    loadBookingScheduleAdminRoutes: () =>
      import("./routes/booking-schedule").then((m) =>
        m.createBookingScheduleAdminRoutesForOperator(),
      ),
    loadPaymentPolicyPublicRoutes: () =>
      import("./routes/booking-schedule").then((m) =>
        m.createPaymentPolicyPublicRoutesForOperator(),
      ),
    loadQuoteVersionSnapshotRoutes: () =>
      import("./routes/quote-version-snapshot-routes").then((m) =>
        m.createOperatorQuoteVersionSnapshotRoutes(),
      ),
    loadBookingMaintenanceRoutes: async () => {
      const [
        { createBookingMaintenanceRoutes },
        { operatorPostgresDb },
        { resolveBookingTaxSettings },
      ] = await Promise.all([
        import("@voyant-travel/commerce/checkout"),
        import("./runtime/operator-runtime-adapter"),
        import("@voyant-travel/operator-settings"),
      ])
      return createBookingMaintenanceRoutes({
        resolveDb: (c) => operatorPostgresDb(c.get("db")),
        resolveBookingTaxSettings,
      })
    },
    loadActionLedgerHealthRoutes: () =>
      import("./runtime/action-ledger-health-runtime").then((m) =>
        m.createActionLedgerHealthAdminRoutes(),
      ),
    loadProposalAdminRoutes: () =>
      import("./routes/proposal-routes").then((m) => m.createProposalAdminRoutes()),
    loadProposalPublicRoutes: () =>
      import("./routes/proposal-routes").then((m) => m.createProposalPublicRoutes()),
    loadCatalogOffersRoutes: () =>
      import("./runtime/catalog-offers-runtime").then((m) =>
        m.createCatalogOffersAdminRoutesForOperator(),
      ),
    loadCatalogCheckoutRoutes: () =>
      import("./routes/catalog-checkout").then((m) => m.createCatalogCheckoutPublicRoutes()),
  }
}

/** Deployment implementations for package-declared runtime ports. */
export function buildOperatorRuntimePorts(): VoyantGraphRuntimePorts {
  return {
    [relationshipsRouteRuntimePort.id]: {
      customFields: resolveOperatorCustomFields,
    },
    [flightsRuntimePort.id]: import("./runtime/flights-runtime").then(
      (runtime) => runtime.operatorFlightsRuntime,
    ),
    [notificationsRuntimePort.id]: createOperatorNotificationsRuntimeProvider(),
    [legalRuntimePort.id]: {
      resolveDocumentDownloadUrl: resolveOperatorDocumentDownloadUrl,
      resolveDocumentStorage: createOperatorDocumentStorage,
      resolveDocumentGenerator: resolveOperatorContractDocumentGenerator,
      resolveBookingPiiService: createOperatorBookingPiiService,
    },
    [legalBookingContractSubscriberRuntimePort.id]: {
      createRuntime(bindings: unknown): LegalBookingContractSubscriberRuntime | null {
        const documentGenerator = resolveOperatorContractDocumentGenerator(bindings)
        if (!documentGenerator) {
          console.error(
            "[legal] autoGenerateContractOnConfirmed.enabled=true but no documentGenerator resolved; skipping subscriber.",
          )
          return null
        }
        return {
          options: AUTO_GENERATE_CONTRACT_OPTIONS,
          withDb: (runtimeBindings, operation) =>
            withDbFromEnv(runtimeBindings as AppBindings, operation),
          documentGenerator,
          documentStorage: createOperatorDocumentStorage(bindings),
          resolveBookingPiiService: () => createOperatorBookingPiiService(bindings),
          resolveVariables: AUTO_GENERATE_CONTRACT_OPTIONS.resolveVariables,
          resolveActionLedgerContext: (event) => ({
            userId: event.actorId,
            actor: event.actorId ? "staff" : "system",
            callerType: "internal",
            isInternalRequest: true,
          }),
        }
      },
    },
    [storageMediaRuntimePort.id]: import("./runtime/media-runtime").then(
      (runtime) => runtime.operatorStorageMediaRuntime,
    ),
    [realtimeRuntimePort.id]: {
      resolveProviders: resolveRealtimeProviders,
      bridgeRoutes: operatorRealtimeBridgeRoutes,
    },
  }
}

function createLazyCatalogSearchRuntime(
  c: Parameters<OperatorCapabilities["resolveCatalogRuntime"]>[0],
): CatalogSearchRuntime {
  const env = c.env as AppBindings & {
    VOYANT_API_KEY?: string
    VOYANT_CLOUD_API_KEY?: string
    VOYANT_CLOUD_API_URL?: string
    TENANT_ID?: string
    TYPESENSE_HOST?: string
    TYPESENSE_ADMIN_API_KEY?: string
    TYPESENSE_API_KEY?: string
    VOYANT_STOREFRONT_CHANNEL_ID?: string
  }
  const actor = c.var.actor ?? "staff"
  const audience: CatalogSearchRuntime["defaultScope"]["audience"] =
    actor === "staff" ? "staff" : actor
  const embeddings = createLazyCatalogEmbeddingProvider(env)

  return {
    indexer: createLazyCatalogIndexer(env, embeddings),
    embeddings,
    defaultScope: {
      locale: "en-GB",
      audience,
      market: "default",
      channel: env.VOYANT_STOREFRONT_CHANNEL_ID,
    },
  }
}

function createLazyCatalogEmbeddingProvider(
  env: AppBindings & {
    VOYANT_API_KEY?: string
    VOYANT_CLOUD_API_KEY?: string
    VOYANT_CLOUD_API_URL?: string
  },
): EmbeddingProvider | undefined {
  if (!(env.VOYANT_API_KEY ?? env.VOYANT_CLOUD_API_KEY)) return undefined
  let providerPromise: Promise<EmbeddingProvider | undefined> | undefined
  return {
    capabilities: {
      modelId: "gemini/gemini-embedding-001/v1",
      dimensions: 3072,
      maxTokensPerInput: 2048,
      maxBatchSize: 100,
      supportedLanguages: null,
    },
    async embed(texts) {
      providerPromise ??= import("./lib/catalog-runtime").then((m) => m.buildEmbeddingProvider(env))
      const provider = await providerPromise
      if (!provider) throw new Error("Catalog embedding provider is not configured")
      return provider.embed(texts)
    },
  }
}

function createLazyCatalogIndexer(
  env: AppBindings & {
    TYPESENSE_HOST?: string
    TYPESENSE_ADMIN_API_KEY?: string
    TYPESENSE_API_KEY?: string
  },
  embeddings: EmbeddingProvider | undefined,
): IndexerAdapter | undefined {
  const host = env.TYPESENSE_HOST
  const apiKey = env.TYPESENSE_ADMIN_API_KEY ?? env.TYPESENSE_API_KEY
  if (!host || !apiKey) return undefined
  try {
    new URL(host)
  } catch {
    return undefined
  }

  let indexerPromise: Promise<IndexerAdapter | undefined> | undefined
  const loadIndexer = async () => {
    indexerPromise ??= import("./lib/catalog-runtime").then((m) =>
      m.buildTypesenseIndexer(env, embeddings),
    )
    const indexer = await indexerPromise
    if (!indexer) throw new Error("Catalog indexer is not configured")
    return indexer
  }

  const vectorDimensions = embeddings?.capabilities.dimensions ?? null
  return {
    capabilities: {
      supportsKeywordSearch: true,
      supportsHybridSearch: vectorDimensions != null,
      supportsVectorFields: vectorDimensions != null,
      vectorDimensions,
      maxVectorsPerDocument: null,
      supportsCrossAudienceFederation: true,
      supportsAdminDenormalization: true,
    },
    async ensureCollection(slice, registry) {
      return (await loadIndexer()).ensureCollection(slice, registry)
    },
    async upsert(slice, documents) {
      return (await loadIndexer()).upsert(slice, documents)
    },
    async delete(slice, ids) {
      return (await loadIndexer()).delete(slice, ids)
    },
    async search(slice, request) {
      return (await loadIndexer()).search(slice, request)
    },
    async bulkReindex(slice, stream, options) {
      return (await loadIndexer()).bulkReindex(slice, stream, options)
    },
  }
}

/**
 * Custom extensions dropped into `src/extensions/<name>/index.ts` are
 * auto-discovered and mounted onto an EXISTING module's surface (the "custom
 * route on an existing module without forking" seam). Same build-time
 * `import.meta.glob` mechanism as modules; each default export is a
 * `HonoExtension`/`ExtensionFactory` (see `defineDeploymentExtension`) targeting
 * `extension.module`. Empty until a deployment adds one. The standard extensions
 * stay framework-owned (with injected provider closures); these are purely
 * deployment-local. See docs/architecture/custom-modules.md.
 */
const discoveredExtensions = extensionsFromGlob<OperatorCapabilities>(
  import.meta.glob("../extensions/*/index.ts", { eager: true }),
)

export const deploymentLocalExtensions: Record<string, ExtensionFactory<OperatorCapabilities>> = {
  ...discoveredExtensions,
}

/**
 * Canonical package-owned units whose factories still need deployment options.
 * The keys are graph ids; package selection and runtime imports remain generated.
 */
export const operatorGraphCompatibilityModules: Record<
  string,
  ModuleFactory<OperatorCapabilities>
> = {
  "@voyant-travel/catalog#booking-engine":
    frameworkComposition.modules["@voyant-travel/catalog/booking-engine"]!,
  "@voyant-travel/storefront": frameworkComposition.modules["@voyant-travel/storefront"]!,
  "@voyant-travel/storefront#payment-link":
    frameworkComposition.modules["@voyant-travel/storefront/payment-link"]!,
  "@voyant-travel/storefront#customer-portal":
    frameworkComposition.modules["@voyant-travel/storefront/customer-portal"]!,
  "@voyant-travel/storefront#verification":
    frameworkComposition.modules["@voyant-travel/storefront/verification"]!,
  "@voyant-travel/legal#contract-document":
    frameworkComposition.modules["@voyant-travel/legal/contract-document"]!,
}

export const operatorGraphCompatibilityExtensions: Record<
  string,
  ExtensionFactory<OperatorCapabilities>
> = {
  "@voyant-travel/accommodations#content-extension":
    frameworkComposition.extensions!["@voyant-travel/accommodations/content-extension"]!,
  "@voyant-travel/action-ledger#health-extension":
    frameworkComposition.extensions!["@voyant-travel/action-ledger/health-extension"]!,
  "@voyant-travel/catalog#offers-extension":
    frameworkComposition.extensions!["@voyant-travel/catalog/offers-extension"]!,
  "@voyant-travel/commerce#booking-maintenance-extension":
    frameworkComposition.extensions!["@voyant-travel/commerce/booking-maintenance-extension"]!,
  "@voyant-travel/commerce#catalog-checkout-extension":
    frameworkComposition.extensions!["@voyant-travel/commerce/catalog-checkout-extension"]!,
  "@voyant-travel/cruises#content-extension":
    frameworkComposition.extensions!["@voyant-travel/cruises/content-extension"]!,
  "@voyant-travel/finance#booking-schedule-extension":
    frameworkComposition.extensions!["@voyant-travel/finance/booking-schedule-extension"]!,
  "@voyant-travel/inventory#brochure-extension":
    frameworkComposition.extensions!["@voyant-travel/inventory/brochure-extension"]!,
  "@voyant-travel/inventory#content-extension":
    frameworkComposition.extensions!["@voyant-travel/inventory/content-extension"]!,
  "@voyant-travel/quotes#proposal-extension":
    frameworkComposition.extensions!["@voyant-travel/quotes/proposal-extension"]!,
  "@voyant-travel/quotes#quote-version-snapshot-extension":
    frameworkComposition.extensions!["@voyant-travel/quotes/quote-version-snapshot-extension"]!,
}

export const operatorGraphRuntimeBindings: VoyantGraphRuntimeBindings<OperatorCapabilities> = {
  ...bindingsFromModuleFactories({
    ...operatorGraphCompatibilityModules,
  }),
  ...bindingsFromExtensionFactories({
    ...deploymentLocalExtensions,
    ...operatorGraphCompatibilityExtensions,
  }),
  "@voyant-travel/quotes": ({ capabilities, runtimeExports, unit }) =>
    singleRuntimeFactory<typeof import("@voyant-travel/quotes").createQuotesHonoModule>(
      unit.id,
      runtimeExports,
    )({
      resolveParticipantPersonById: async (db, personId) =>
        (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
    }),
  "@voyant-travel/bookings#requirements": ({ capabilities, runtimeExports, unit }) =>
    singleRuntimeFactory<
      typeof import("@voyant-travel/bookings/requirements").createBookingRequirementsHonoModule
    >(
      unit.id,
      runtimeExports,
    )({
      publicRoutes: {
        resolveProductSnapshot: capabilities.resolveBookingRequirementsProductSnapshot,
      },
    }),
  "@voyant-travel/catalog": async ({ capabilities, runtimeExports, unit }) => {
    const createCatalog = singleRuntimeFactory<
      typeof import("@voyant-travel/catalog").createCatalogSearchHonoModule
    >(unit.id, runtimeExports)
    const { executeSemanticSearch } = await import("@voyant-travel/catalog")
    return createCatalog({
      resolveRuntime: capabilities.resolveCatalogRuntime,
      executeSearch: ({ adapter, embeddings, slice, request }) =>
        executeSemanticSearch({
          adapter,
          embeddings: embeddings as Parameters<typeof executeSemanticSearch>[0]["embeddings"],
          slice,
          request,
        }),
    })
  },
  "@voyant-travel/bookings": async ({ capabilities, runtimeExports, unit }) => {
    const createBookings = singleRuntimeFactory<
      typeof import("@voyant-travel/bookings").createBookingsHonoModule
    >(unit.id, runtimeExports)
    const accommodationsOverview = await import(
      "@voyant-travel/accommodations/booking-overview-enricher"
    )
    const configured = createBookings({
      resolveTravelSnapshot: (db, personId, { kms }) =>
        capabilities.relationshipsService.loadPersonTravelSnapshot(db, personId, { kms }),
      resolveBillingPerson: async (db, contact, ctx) =>
        (
          await capabilities.relationshipsService.upsertPersonFromContact(db, contact, {
            source: ctx.source,
            sourceRef: ctx.sourceRef,
          })
        )?.id ?? null,
      resolveTravelerPerson: async (db, contact, ctx) =>
        (
          await capabilities.relationshipsService.upsertPersonFromContact(db, contact, {
            source: ctx.source,
            sourceRef: ctx.sourceRef,
            requireContactPoint: true,
          })
        )?.id ?? null,
      resolveBillingPersonById: async (db, personId) =>
        (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
      resolveBillingOrganizationById: async (db, organizationId) =>
        (await capabilities.relationshipsService.getOrganizationById(db, organizationId)) != null,
      closePaymentSchedulesForBooking: capabilities.closePaymentSchedulesForBooking,
      recordCancellationFinancialSettlement: capabilities.recordCancellationFinancialSettlement,
      customFields: capabilities.customFields,
      overviewItemEnrichers: {
        accommodation: accommodationsOverview.enrichStayBookingOverviewItems,
      },
    })
    return withModuleWorkflowService(configured, registerBookingsWorkflowService)
  },
  "@voyant-travel/finance": createOperatorFinanceGraphModule,
  "@voyant-travel/mice": ({ capabilities, runtimeExports, unit }) =>
    singleRuntimeFactory<typeof import("@voyant-travel/mice").createMiceHonoModule>(
      unit.id,
      runtimeExports,
    )({
      resolveDelegatePersonById: async (db, personId) =>
        (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
    }),
  "@voyant-travel/inventory": ({ runtimeExports, unit }) =>
    withModuleWorkflowService(
      singleRuntimeValue<HonoModule>(unit.id, runtimeExports),
      registerInventoryWorkflowService,
    ),
  "@voyant-travel/trips": ({ capabilities, runtimeExports, unit }) => {
    const configured = singleRuntimeFactory<
      typeof import("@voyant-travel/trips").createTripsHonoModule
    >(
      unit.id,
      runtimeExports,
    )({
      routesOptions: capabilities.createTripsRoutesOptions,
      publicRoutes: true,
    })
    return withModuleRuntimeService(configured, (container, bindings) => {
      const runtime: TripsPaymentSubscriberRuntime = {
        withDb: (operation) =>
          capabilities.withDb
            ? capabilities.withDb(bindings, operation)
            : operation(capabilities.resolveDb(bindings)),
      }
      container.register(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY, runtime)
    })
  },
  "@voyant-travel/distribution#channel-push-extension": ({
    capabilities,
    runtimeExports,
    unit,
  }) => {
    const configured = capabilities.createChannelPushExtension(
      singleRuntimeFactory<typeof import("@voyant-travel/distribution").createChannelPushExtension>(
        unit.id,
        runtimeExports,
      ),
    )
    return withExtensionRuntimeService(configured, registerDistributionWorkflowService)
  },
  "@voyant-travel/finance#booking-tax-extension": async ({ runtimeExports, unit }) => {
    const createBookingTax = singleRuntimeFactory<
      typeof import("@voyant-travel/finance").createBookingTaxHonoExtension
    >(unit.id, runtimeExports)
    const settings = await import("@voyant-travel/operator-settings")
    return createBookingTax({
      resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
      updateBookingTaxSettings: settings.updateBookingTaxSettings,
    })
  },
  // Remaining API compatibility: the package exports a HonoModule factory
  // while selected plugins currently compose as HonoExtensions. Subscriber
  // descriptors are generic graph facets and are not registered by this binding.
  "@voyant-travel/plugin-smartbill": ({ capabilities, runtimeExports, unit }) => {
    const createSmartbillAdmin = singleRuntimeFactory<
      typeof import("@voyant-travel/plugin-smartbill").createSmartbillAdminModule
    >(unit.id, runtimeExports)
    const configured = createSmartbillAdmin({
      pluginOptions: (bindings) => resolveOperatorSmartbillOptions(bindings, capabilities),
    })

    return {
      extension: {
        name: configured.module.name,
        module: configured.module.name,
        bootstrap: async (context) => {
          const { registerOperatorSmartbillSubscriberRuntimeService } = await import(
            "./runtime/smartbill-subscriber-runtime"
          )
          await registerOperatorSmartbillSubscriberRuntimeService(context)
          if (isOperatorSmartbillConfigured(context.bindings)) {
            await configured.module.bootstrap?.(context)
          }
        },
      },
      adminRoutes: configured.adminRoutes,
    }
  },
}

function resolveOperatorSmartbillOptions(
  bindings: unknown,
  capabilities: OperatorCapabilities,
): SmartbillPluginOptions {
  const env = bindings as AppBindings
  const username = nonEmpty(env.SMARTBILL_USERNAME)
  const apiToken = nonEmpty(env.SMARTBILL_API_TOKEN) ?? nonEmpty(env.SMARTBILL_TOKEN)
  const companyVatCode = nonEmpty(env.SMARTBILL_COMPANY_VAT_CODE)
  const seriesName =
    nonEmpty(env.SMARTBILL_INVOICE_SERIES_NAME) ?? nonEmpty(env.SMARTBILL_SERIES_NAME)
  if (!username || !apiToken || !companyVatCode || !seriesName) {
    throw new Error("SmartBill is not configured for this operator deployment.")
  }

  return {
    username,
    apiToken,
    apiUrl: nonEmpty(env.SMARTBILL_API_URL),
    companyVatCode,
    seriesName,
    language: nonEmpty(env.SMARTBILL_LANGUAGE),
    art311SpecialRegime: env.SMARTBILL_ART_311_SPECIAL_REGIME === "true",
    artifacts: {
      db: operatorPostgresDb(capabilities.resolveDb(bindings)),
      documentStorage: capabilities.createOperatorDocumentStorage(bindings),
    },
  }
}

function isOperatorSmartbillConfigured(bindings: unknown): boolean {
  const env = bindings as AppBindings
  return Boolean(
    nonEmpty(env.SMARTBILL_USERNAME) &&
      (nonEmpty(env.SMARTBILL_API_TOKEN) ?? nonEmpty(env.SMARTBILL_TOKEN)) &&
      nonEmpty(env.SMARTBILL_COMPANY_VAT_CODE) &&
      (nonEmpty(env.SMARTBILL_INVOICE_SERIES_NAME) ?? nonEmpty(env.SMARTBILL_SERIES_NAME)),
  )
}

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function bindingsFromModuleFactories(
  factories: Record<string, ModuleFactory<OperatorCapabilities>>,
): VoyantGraphRuntimeBindings<OperatorCapabilities> {
  return Object.fromEntries(
    Object.entries(factories).map(([id, factory]) => [
      id,
      ({ capabilities }: VoyantGraphRuntimeBindingContext<OperatorCapabilities>) =>
        factory({ capabilities, options: {} }),
    ]),
  )
}

function bindingsFromExtensionFactories(
  factories: Record<string, ExtensionFactory<OperatorCapabilities>>,
): VoyantGraphRuntimeBindings<OperatorCapabilities> {
  return Object.fromEntries(
    Object.entries(factories).map(([id, factory]) => [
      id,
      ({ capabilities }: VoyantGraphRuntimeBindingContext<OperatorCapabilities>) =>
        factory({ capabilities, options: {} }),
    ]),
  )
}

function singleRuntimeFactory<T>(unitId: string, runtimeExports: readonly unknown[]): T {
  const value = singleRuntimeValue<unknown>(unitId, runtimeExports)
  if (typeof value !== "function") {
    throw new Error(`Graph runtime unit ${unitId} must load one factory export.`)
  }
  return value as T
}

function singleRuntimeValue<T>(unitId: string, runtimeExports: readonly unknown[]): T {
  if (runtimeExports.length !== 1) {
    throw new Error(
      `Graph runtime unit ${unitId} must load exactly one distinct export, got ${runtimeExports.length}.`,
    )
  }
  return runtimeExports[0] as T
}

type RuntimeServiceRegistration = (
  container: import("@voyant-travel/core").ModuleContainer,
  bindings: AppBindings,
) => Promise<void> | void

function withModuleWorkflowService<T extends HonoModule>(
  configured: T,
  register: RuntimeServiceRegistration,
): T {
  return withModuleRuntimeService(configured, register)
}

function withModuleRuntimeService<T extends HonoModule>(
  configured: T,
  register: RuntimeServiceRegistration,
): T {
  const bootstrap = configured.module.bootstrap
  return {
    ...configured,
    module: {
      ...configured.module,
      bootstrap: async (ctx) => {
        await register(ctx.container, ctx.bindings as AppBindings)
        await bootstrap?.(ctx)
      },
    },
  }
}

function withExtensionRuntimeService<T extends HonoExtension>(
  configured: T,
  register: RuntimeServiceRegistration,
): T {
  const bootstrap = configured.extension.bootstrap
  return {
    ...configured,
    extension: {
      ...configured.extension,
      bootstrap: async (ctx) => {
        await register(ctx.container, ctx.bindings as AppBindings)
        await bootstrap?.(ctx)
      },
    },
  }
}

async function createOperatorFinanceGraphModule({
  capabilities,
  runtimeExports,
  unit,
}: VoyantGraphRuntimeBindingContext<OperatorCapabilities>) {
  const createFinance = singleRuntimeFactory<
    typeof import("@voyant-travel/finance").createFinanceHonoModule
  >(unit.id, runtimeExports)
  const [notifications, settings] = await Promise.all([
    import("@voyant-travel/notifications"),
    import("@voyant-travel/operator-settings"),
  ])
  return createFinance({
    resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
      capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
    resolveInvoiceExchangeRateResolver: capabilities.createInvoiceExchangeRateResolver,
    resolveInvoiceSettlementPollers: capabilities.createInvoiceSettlementPollers,
    invoiceDueDateResolver: ({ issueDate, dueDate, bookingPaymentSchedule }) =>
      bookingPaymentSchedule && dueDate < issueDate ? issueDate : dueDate,
    resolveNotificationDispatcher: (bindings) => {
      const providers = capabilities.resolveNotificationProviders(bindings)
      if (providers.length === 0) return null
      const dispatcher = notifications.createNotificationService(providers)
      return {
        sendInvoiceNotification: async (db, invoiceId, input) =>
          toCheckoutNotificationDelivery(
            await notifications.notificationsService.sendInvoiceNotification(
              db,
              dispatcher,
              invoiceId,
              input,
            ),
          ),
        sendPaymentSessionNotification: async (db, paymentSessionId, input) =>
          toCheckoutNotificationDelivery(
            await notifications.notificationsService.sendPaymentSessionNotification(
              db,
              dispatcher,
              paymentSessionId,
              input,
            ),
          ),
      }
    },
    resolvePaymentStarters: capabilities.resolvePaymentStarters,
    policy: capabilities.financeCheckoutPolicy,
    paymentScheduleLineDescriptionFormat: capabilities.financePaymentScheduleLineDescriptionFormat,
    resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
    updateBookingTaxSettings: settings.updateBookingTaxSettings,
    resolveBankTransferDetails: capabilities.resolveBankTransferDetails,
    resolvePublicCheckoutBaseUrl: capabilities.resolvePublicCheckoutBaseUrl,
    listBookingReminderRuns: async (db, bookingId, query) => {
      const result = await notifications.notificationsService.listReminderRuns(db, {
        bookingId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      })
      return {
        data: result.data.map(toCheckoutReminderRun),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }
    },
  })
}

type NotificationDeliveryLike = {
  id: string
  templateSlug: string | null
  channel: "email" | "sms"
  provider: string
  status: "pending" | "sent" | "failed" | "cancelled"
  toAddress: string
  subject: string | null
  sentAt: Date | string | null
  failedAt: Date | string | null
  errorMessage: string | null
}

function optionalDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function toCheckoutNotificationDelivery(
  delivery: NotificationDeliveryLike | null,
): CheckoutNotificationDelivery | null {
  if (!delivery) return null
  return {
    id: delivery.id,
    templateSlug: delivery.templateSlug,
    channel: delivery.channel,
    provider: delivery.provider,
    status: delivery.status,
    toAddress: delivery.toAddress,
    subject: delivery.subject,
    sentAt: optionalDateTime(delivery.sentAt),
    failedAt: optionalDateTime(delivery.failedAt),
    errorMessage: delivery.errorMessage,
  }
}

function toCheckoutReminderRun(run: {
  id: string
  reminderRuleId: string
  reminderRule: { slug: string; name: string; channel: "email" | "sms"; provider: string | null }
  targetType: CheckoutReminderRunRecord["targetType"]
  targetId: string
  links: {
    bookingId: string | null
    paymentSessionId: string | null
    notificationDeliveryId: string | null
  }
  status: CheckoutReminderRunRecord["status"]
  delivery?: {
    status: CheckoutReminderRunRecord["deliveryStatus"]
    channel: "email" | "sms"
    provider: string | null
  } | null
  recipient: string | null
  scheduledFor: Date | string
  processedAt: Date | string | null
  errorMessage: string | null
  createdAt: Date | string
}): CheckoutReminderRunRecord {
  return {
    id: run.id,
    reminderRuleId: run.reminderRuleId,
    reminderRuleSlug: run.reminderRule.slug,
    reminderRuleName: run.reminderRule.name,
    targetType: run.targetType,
    targetId: run.targetId,
    bookingId: run.links.bookingId,
    paymentSessionId: run.links.paymentSessionId,
    notificationDeliveryId: run.links.notificationDeliveryId,
    status: run.status,
    deliveryStatus: run.delivery?.status ?? null,
    channel: run.delivery?.channel ?? run.reminderRule.channel,
    provider: run.delivery?.provider ?? run.reminderRule.provider ?? null,
    recipient: run.recipient,
    scheduledFor: optionalDateTime(run.scheduledFor) ?? "",
    processedAt: optionalDateTime(run.processedAt) ?? "",
    errorMessage: run.errorMessage,
    relativeDaysFromDueDate: null,
    createdAt: optionalDateTime(run.createdAt) ?? "",
  }
}
