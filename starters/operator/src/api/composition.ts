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

import { accommodationsContentRuntimePort } from "@voyant-travel/accommodations/graph-runtime"
import { actionLedgerHealthRuntimePort } from "@voyant-travel/action-ledger/graph-runtime"
import {
  type BookingsRuntimeProvider,
  bookingRequirementsRuntimePort,
  bookingsRuntimePort,
} from "@voyant-travel/bookings"
import type {
  CatalogSearchRuntime,
  EmbeddingProvider,
  IndexerAdapter,
} from "@voyant-travel/catalog"
import {
  type CatalogBookingSnapshotRuntimeProvider,
  catalogBookingSnapshotRuntimePort,
} from "@voyant-travel/catalog/booking-snapshot-subscriber"
import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "@voyant-travel/catalog/graph-runtime"
import {
  type CatalogProjectionRuntimeProvider,
  catalogProjectionRuntimePort,
} from "@voyant-travel/catalog/projection-runtime"
import {
  type AcceptanceSignatureLegalPort,
  type CatalogCheckoutApiRuntime,
  type CatalogCheckoutContractPdfRuntime,
  type CatalogCheckoutDatabaseRuntime,
  catalogCheckoutApiRuntimePort,
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "@voyant-travel/commerce/catalog-checkout-subscribers"
import { bookingMaintenanceRuntimePort } from "@voyant-travel/commerce/checkout"
import {
  type PromotionRedemptionDatabaseRuntime,
  type PromotionsBulkReindexRuntime,
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "@voyant-travel/commerce/promotion-redemption-subscriber"
import { cruisesContentRuntimePort } from "@voyant-travel/cruises/graph-runtime"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { channelPushRuntimePort } from "@voyant-travel/distribution"
import {
  financeBookingScheduleRuntimePort,
  financeBookingTaxRuntimePort,
  financeRuntimePort,
} from "@voyant-travel/finance"
import type { CheckoutNotificationDelivery } from "@voyant-travel/finance/checkout"
import type { CheckoutReminderRunRecord } from "@voyant-travel/finance/checkout-validation"
import { flightsRuntimePort } from "@voyant-travel/flights"
import {
  extensionsFromGlob,
  type FrameworkProviders,
  type VoyantGraphRuntimeBindingContext,
  type VoyantGraphRuntimeBindings,
  type VoyantGraphRuntimePorts,
} from "@voyant-travel/framework"
import { lazyProvider } from "@voyant-travel/hono"
import type { ExtensionFactory } from "@voyant-travel/hono/composition"
import {
  inventoryBrochureRuntimePort,
  inventoryContentRuntimePort,
  inventoryRuntimePort,
} from "@voyant-travel/inventory/graph-runtime"
import { legalContractDocumentRuntimePort, legalRuntimePort } from "@voyant-travel/legal"
import {
  type LegalBookingContractSubscriberRuntime,
  legalBookingContractSubscriberRuntimePort,
} from "@voyant-travel/legal/booking-contract-subscriber"
import { miceRuntimePort } from "@voyant-travel/mice"
import { notificationsRuntimePort } from "@voyant-travel/notifications"
import type { SmartbillPluginOptions } from "@voyant-travel/plugin-smartbill"
import {
  quotesProposalRuntimePort,
  quotesRuntimePort,
  quotesSnapshotRuntimePort,
} from "@voyant-travel/quotes"
import { realtimeRuntimePort } from "@voyant-travel/realtime"
import { relationshipsRouteRuntimePort } from "@voyant-travel/relationships/voyant"
import { storageMediaRuntimePort } from "@voyant-travel/storage/routes"
import {
  type StorefrontIntakePersistence,
  storefrontCustomerPortalRuntimePort,
  storefrontPaymentLinkRuntimePort,
  storefrontRuntimePort,
  storefrontVerificationRuntimePort,
} from "@voyant-travel/storefront"
import {
  type TripsDatabaseRuntime,
  tripsDatabaseRuntimePort,
  tripsRoutesRuntimePort,
} from "@voyant-travel/trips/voyant"
import {
  type WorkflowRunnerRegistryRuntime,
  workflowRunnerRegistryRuntimePort,
} from "@voyant-travel/workflow-runs/runtime-port"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { resolveOperatorCustomFields } from "../lib/custom-fields"
import { resolveNotificationProviders } from "../lib/notifications"
import { operatorRealtimeBridgeRoutes, resolveRealtimeProviders } from "../lib/realtime"
import { resolveBookingRequirementsProductSnapshot } from "./lib/booking-requirements-product-snapshot"
import { withDbFromEnv } from "./lib/db"
import { createOperatorCheckoutStartOptions } from "./runtime/catalog-checkout-options"
import { AUTO_GENERATE_CONTRACT_OPTIONS } from "./runtime/contract-document-variables"
import { createOperatorNotificationsRuntimeProvider } from "./runtime/notifications-runtime"
import {
  createOperatorBookingPiiService,
  createOperatorDocumentStorage,
  createOperatorInvoiceExchangeRateResolver,
  createOperatorInvoiceSettlementPollers,
  generateContractPdfForBooking,
  operatorBindings,
  operatorPostgresDb,
  readOperatorDocumentContentBase64,
  resolveOperatorContractDocumentGenerator,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./runtime/operator-runtime-adapter"
import {
  registerBookingsWorkflowService,
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
  resolveBookingRequirementsProductSnapshot: typeof resolveBookingRequirementsProductSnapshot
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
    createTripsRoutesOptions: createOperatorTripsRoutesOptions,
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
    loadMcpAdminRoutes: () => import("./runtime/mcp-runtime").then((m) => m.buildMcpAdminRoutes()),
    loadCatalogCheckoutRoutes: () =>
      import("./routes/catalog-checkout").then((m) => m.createCatalogCheckoutPublicRoutes()),
  }
}

/** Deployment implementations for package-declared runtime ports. */
export function buildOperatorRuntimePorts(
  workflowRunnerRegistry?: WorkflowRunnerRegistryRuntime,
  capabilities: OperatorCapabilities = buildOperatorProviders(),
): VoyantGraphRuntimePorts {
  return {
    [quotesRuntimePort.id]: {
      resolveParticipantPersonById: async (db, personId) =>
        (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
    },
    [miceRuntimePort.id]: {
      resolveDelegatePersonById: async (db, personId) =>
        (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
    },
    [quotesProposalRuntimePort.id]: import("./runtime/quote-proposal-runtime").then((runtime) =>
      runtime.createQuoteProposalRoutesOptions(),
    ),
    [quotesSnapshotRuntimePort.id]: import("./runtime/quote-proposal-runtime").then((runtime) =>
      runtime.createQuoteProposalRoutesOptions(),
    ),
    [bookingsRuntimePort.id]: createOperatorBookingsRuntimeProvider(capabilities),
    [bookingRequirementsRuntimePort.id]: {
      publicRoutes: {
        resolveProductSnapshot: capabilities.resolveBookingRequirementsProductSnapshot,
      },
    },
    [financeRuntimePort.id]: createOperatorFinanceRuntimeProvider(capabilities),
    [financeBookingScheduleRuntimePort.id]: import("./routes/booking-schedule").then(
      async (runtime) => ({
        options: await runtime.createBookingScheduleRoutesOptions(),
        withDb: <T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>) =>
          withDbFromEnv(bindings as AppBindings, operation),
      }),
    ),
    [financeBookingTaxRuntimePort.id]: import("@voyant-travel/operator-settings").then(
      (settings) => ({
        resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
        updateBookingTaxSettings: settings.updateBookingTaxSettings,
      }),
    ),
    [storefrontRuntimePort.id]: createOperatorStorefrontRuntimeProvider(capabilities),
    [storefrontPaymentLinkRuntimePort.id]: import("./runtime/payment-link-runtime").then(
      (runtime) => runtime.createOperatorPaymentLinkRouteOptions(),
    ),
    [storefrontCustomerPortalRuntimePort.id]: {
      resolveDocumentDownloadUrl: (bindings, storageKey) =>
        capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
    },
    [storefrontVerificationRuntimePort.id]: {
      resolveProviders: capabilities.resolveNotificationProviders,
      email: { subject: "Your verification code" },
    },
    [legalContractDocumentRuntimePort.id]: import("./runtime/contract-document-runtime").then(
      (runtime) => runtime.createOperatorContractDocumentRoutesOptions(),
    ),
    [bookingMaintenanceRuntimePort.id]: import("@voyant-travel/operator-settings").then(
      (settings) => ({
        resolveDb: (context) => operatorPostgresDb(context.get("db")),
        resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
      }),
    ),
    [catalogSearchRuntimePort.id]: {
      resolveRuntime: capabilities.resolveCatalogRuntime,
    },
    [catalogBookingRuntimePort.id]: import("./runtime/catalog-booking-runtime").then((runtime) =>
      runtime.createOperatorCatalogBookingRouteModuleOptions(),
    ),
    [catalogOffersRuntimePort.id]: import("./runtime/catalog-offers-runtime").then((runtime) =>
      runtime.createOperatorCatalogOffersRouteModuleOptions(),
    ),
    [inventoryRuntimePort.id]: {
      bootstrap: ({ container, bindings }) =>
        registerInventoryWorkflowService(container, bindings as AppBindings),
    },
    [inventoryContentRuntimePort.id]: import("./routes/catalog-content").then((runtime) =>
      runtime.createOperatorInventoryContentRuntime(),
    ),
    [inventoryBrochureRuntimePort.id]: import("./runtime/media-runtime").then(
      (runtime) => runtime.operatorInventoryBrochureRuntime,
    ),
    [cruisesContentRuntimePort.id]: import("./routes/catalog-content").then((runtime) =>
      runtime.createOperatorCruisesContentRuntime(),
    ),
    [accommodationsContentRuntimePort.id]: import("./routes/catalog-content").then((runtime) =>
      runtime.createOperatorAccommodationsContentRuntime(),
    ),
    [actionLedgerHealthRuntimePort.id]: import("./runtime/action-ledger-health-runtime").then(
      (runtime) => runtime.createOperatorActionLedgerHealthRuntime(),
    ),
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
            withDbFromEnv(operatorBindings(runtimeBindings), (db) =>
              operation(operatorPostgresDb(db)),
            ),
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
    [catalogCheckoutApiRuntimePort.id]: ((context) =>
      createOperatorCheckoutStartOptions(context)) satisfies CatalogCheckoutApiRuntime,
    [catalogProjectionRuntimePort.id]:
      createOperatorCatalogProjectionRuntimeProvider() satisfies CatalogProjectionRuntimeProvider,
    [catalogBookingSnapshotRuntimePort.id]: {
      createRuntime: (bindings) =>
        import("./runtime/catalog-subscriber-runtime").then((runtime) =>
          runtime.createOperatorCatalogBookingSnapshotRuntime(bindings),
        ),
    } satisfies CatalogBookingSnapshotRuntimeProvider,
    [channelPushRuntimePort.id]: import("./runtime/channel-push-runtime").then(
      (runtime) => runtime.operatorChannelPushRuntime,
    ),
    [tripsRoutesRuntimePort.id]: createOperatorTripsRoutesOptions,
    [tripsDatabaseRuntimePort.id]: {
      withDb: <T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T> =>
        withDbFromEnv(operatorBindings(bindings), (db) => operation(operatorPostgresDb(db))),
    } satisfies TripsDatabaseRuntime,
    [storageMediaRuntimePort.id]: import("./runtime/media-runtime").then(
      (runtime) => runtime.operatorStorageMediaRuntime,
    ),
    [realtimeRuntimePort.id]: {
      resolveProviders: resolveRealtimeProviders,
      bridgeRoutes: operatorRealtimeBridgeRoutes,
    },
    [catalogCheckoutDatabaseRuntimePort.id]: {
      withDb: <T>(
        bindings: unknown,
        operation: (db: PostgresJsDatabase) => Promise<T>,
      ): Promise<T> =>
        withDbFromEnv(operatorBindings(bindings), (db) => operation(operatorPostgresDb(db))),
    } satisfies CatalogCheckoutDatabaseRuntime,
    [catalogCheckoutLegalRuntimePort.id]: import("@voyant-travel/legal/contracts").then(
      ({ contractsService }) =>
        ({
          getContract: contractsService.getContractById,
          listSignatures: contractsService.listSignatures,
          sendContract: (db, contractId, eventBus) =>
            contractsService.sendContract(db, contractId, { eventBus }),
          signContract: (db, contractId, input, eventBus) =>
            contractsService.signContract(db, contractId, input as never, { eventBus }),
        }) satisfies AcceptanceSignatureLegalPort,
    ),
    [catalogCheckoutContractPdfRuntimePort.id]: {
      generate: ({ bindings, db, eventBus, bookingId, force }) =>
        generateContractPdfForBooking(operatorBindings(bindings), db, eventBus, bookingId, {
          force,
        }),
    } satisfies CatalogCheckoutContractPdfRuntime,
    [promotionRedemptionDatabaseRuntimePort.id]: {
      withDb: <T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T> =>
        withDbFromEnv(operatorBindings(bindings), (db) => operation(operatorPostgresDb(db))),
    } satisfies PromotionRedemptionDatabaseRuntime,
    [promotionsBulkReindexRuntimePort.id]: {
      createService: (bindings: unknown) =>
        import("./lib/bulk-reindex-service").then((runtime) =>
          runtime.createBulkReindexProductsService(operatorBindings(bindings)),
        ),
    } satisfies PromotionsBulkReindexRuntime,
    ...(workflowRunnerRegistry
      ? { [workflowRunnerRegistryRuntimePort.id]: workflowRunnerRegistry }
      : {}),
  }
}

async function createOperatorBookingsRuntimeProvider(
  capabilities: OperatorCapabilities,
): Promise<BookingsRuntimeProvider> {
  const accommodationsOverview = await import(
    "@voyant-travel/accommodations/booking-overview-enricher"
  )
  return {
    options: {
      resolveTravelSnapshot: (db, personId, { kms }) =>
        capabilities.relationshipsService.loadPersonTravelSnapshot(db, personId, { kms }),
      resolveBillingPerson: async (db, contact, context) =>
        (
          await capabilities.relationshipsService.upsertPersonFromContact(db, contact, {
            source: context.source,
            sourceRef: context.sourceRef,
          })
        )?.id ?? null,
      resolveTravelerPerson: async (db, contact, context) =>
        (
          await capabilities.relationshipsService.upsertPersonFromContact(db, contact, {
            source: context.source,
            sourceRef: context.sourceRef,
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
    },
    registerWorkflowService: ({ container, bindings }) =>
      registerBookingsWorkflowService(container, bindings as AppBindings),
  }
}

async function createOperatorStorefrontRuntimeProvider(capabilities: OperatorCapabilities) {
  const commerce = await import("@voyant-travel/commerce")
  return {
    offers: commerce.createCommerceStorefrontOfferResolvers(),
    bookingIntents: {
      withDb: (bindings: unknown, operation: (db: PostgresJsDatabase) => Promise<unknown>) =>
        withDbFromEnv(bindings as AppBindings, (db) => operation(db as PostgresJsDatabase)),
    },
    intake: { persistence: capabilities.storefrontIntakePersistence },
  }
}

function createOperatorCatalogProjectionRuntimeProvider(): CatalogProjectionRuntimeProvider {
  let runtime: ReturnType<CatalogProjectionRuntimeProvider["createRuntime"]> | undefined
  return {
    createRuntime(bindings) {
      runtime ??= import("./runtime/catalog-subscriber-runtime").then((module) =>
        module.createOperatorCatalogProjectionRuntime(bindings),
      )
      return runtime
    },
  }
}

const createOperatorTripsRoutesOptions: FrameworkProviders["createTripsRoutesOptions"] = () =>
  import("./runtime/trips-runtime").then((runtime) => runtime.createOperatorTripsRoutesOptions())

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
export const operatorGraphRuntimeBindings: VoyantGraphRuntimeBindings<OperatorCapabilities> = {
  ...bindingsFromExtensionFactories({
    ...deploymentLocalExtensions,
  }),
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

async function createOperatorFinanceRuntimeProvider(capabilities: OperatorCapabilities) {
  const [notifications, settings] = await Promise.all([
    import("@voyant-travel/notifications"),
    import("@voyant-travel/operator-settings"),
  ])
  return {
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
  }
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
