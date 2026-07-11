// agent-quality: file-size exception -- this entry is the managed profile
// runtime composition boundary: profile validation, env binding assembly, and
// provider defaults stay together so Cloud boot behavior is auditable.
import { readFile } from "node:fs/promises"

import { OpenAPIHono } from "@hono/zod-openapi"
import { createAccommodationContentRoutes } from "@voyant-travel/accommodations/routes-content"
import {
  type ActionLedgerCapabilityRegistry,
  createActionLedgerCapabilityRegistry,
} from "@voyant-travel/action-ledger/capability"
import {
  createVoyantCloudAdminAuthPlugin,
  revalidateVoyantCloudAdminAuthSession,
  revalidateVoyantCloudAdminAuthUser,
} from "@voyant-travel/auth/cloud-admin-session"
import {
  buildClearCloudAdminAuthStateCookie,
  createCloudAdminAuthStart,
} from "@voyant-travel/auth/cloud-broker"
import { createBetterAuth } from "@voyant-travel/auth/server"
import {
  bookingsService,
  redactBookingContact,
  shouldRevealBookingPii,
} from "@voyant-travel/bookings"
import { submitBookingReservationPlan } from "@voyant-travel/bookings/reservation-plans"
import type { BookingsToolServices } from "@voyant-travel/bookings/tools"
import {
  type CatalogSearchRuntime,
  type CatalogToolServices,
  executeSemanticSearch,
} from "@voyant-travel/catalog"
import {
  type CatalogAvailabilitySlotsScope,
  type CatalogBookingRouteModuleOptions,
  createOwnedBookingHandlerRegistry,
  createSourceAdapterRegistry,
  mountCatalogBookingRoutes as mountPackageCatalogBookingRoutes,
  type OwnedBookingHandlerRegistry,
  type SlotRow,
  type SourceAdapterRegistry,
} from "@voyant-travel/catalog/booking-engine"
import type {
  CatalogOffersAirportLabel,
  CatalogOffersConnectClient,
  CatalogOffersIndexFields,
  CatalogOffersRouteModuleOptions,
  CatalogOffersSearchDestination,
} from "@voyant-travel/catalog/offers"
import { type CreateVideoUploadInput, getVoyantCloudClient } from "@voyant-travel/cloud-sdk"
import { createVoyantConnectClient } from "@voyant-travel/connect-sdk"
import type { EventBus } from "@voyant-travel/core"
import { createCruiseContentRoutes } from "@voyant-travel/cruises/routes-content"
import {
  createDbClient,
  createPostgresFixedWindowRateLimitStore,
  createPostgresKvStore,
} from "@voyant-travel/db/runtime"
import { authUser, cloudAuthUserLinks, userProfilesTable } from "@voyant-travel/db/schema/iam"
import {
  type BookingScheduleRoutesOptions,
  financeService,
  type PaymentPolicy,
  type PaymentPolicyEntityContext,
  type ResolveInvoiceExchangeRate,
  readPolicySourceFromInternalNotes,
} from "@voyant-travel/finance"
import type { FinanceToolServices } from "@voyant-travel/finance/tools"
import type { FlightConnectorAdapter } from "@voyant-travel/flights"
import {
  createMemoryRateLimitStore,
  createRedisRateLimitStore,
  isStaffRbacEnforced,
  type VoyantAuthIntegration,
  type VoyantBindings,
  type VoyantDb,
} from "@voyant-travel/hono"
import type { ExtensionFactory, ModuleFactory } from "@voyant-travel/hono/composition"
import { productsService } from "@voyant-travel/inventory"
import { createProductContentRoutes } from "@voyant-travel/inventory/routes-content"
import { getProductContent } from "@voyant-travel/inventory/service-content"
import type { InventoryToolServices } from "@voyant-travel/inventory/tools"
import {
  type ContractDocumentGeneratorContext,
  createContractDocumentRoutes,
  createContractDocumentService,
  createPdfContractDocumentGenerator,
} from "@voyant-travel/legal"
import { buildContractVariableBindings } from "@voyant-travel/legal/contract-variables"
import { createMcpHonoApp } from "@voyant-travel/mcp"
import {
  createNotificationService,
  createVoyantCloudEmailProvider,
  createVoyantCloudSmsProvider,
  type NotificationProvider,
  notificationsService,
} from "@voyant-travel/notifications"
import type { NotificationsToolServices } from "@voyant-travel/notifications/tools"
import { availabilitySlots } from "@voyant-travel/operations"
import {
  getOperatorPaymentInstructions,
  getOperatorProfile,
  getOperatorSettings,
  resolveBookingTaxSettings,
  resolveOperatorDefaultPaymentPolicy,
  toPublicOperatorSettings,
} from "@voyant-travel/operator-settings"
import {
  createQuoteProposalAdminRoutes,
  createQuoteProposalPublicRoutes,
  type QuoteProposalRoutesOptions,
  quotesService,
} from "@voyant-travel/quotes"
import type { QuotesToolServices } from "@voyant-travel/quotes/tools"
import { relationshipsService } from "@voyant-travel/relationships"
import type { RelationshipsToolServices } from "@voyant-travel/relationships/tools"
import {
  type CreateNodeServerOptions,
  composeNodeEnv,
  createMemoryKvNamespace,
  createMemoryR2Bucket,
  createNodeServer,
  createR2BucketShim,
  type ExecutionContextLike,
  type KvNamespaceShim,
  type NodeServerHandle,
  type R2BucketShim,
} from "@voyant-travel/runtime"
import { createR2Provider, type R2BucketLike } from "@voyant-travel/storage/providers/r2"
import type { VideoUploadTicketRequest } from "@voyant-travel/storage/routes"
import type { PaymentLinkRoutesOptions } from "@voyant-travel/storefront/payment-link"
import { createToolRegistry, type ToolContext, ToolError } from "@voyant-travel/tools"
import {
  type CancelTripComponentsDeps,
  type ReserveTripDeps,
  type StartCheckoutDeps,
  type TripsToolServices,
  tripsService,
} from "@voyant-travel/trips"
import { scopesForRole } from "@voyant-travel/types/member-roles"
import type { KVStore } from "@voyant-travel/utils/cache"
import { createRedisKvStore } from "@voyant-travel/utils/redis-kv"
import { createTieredKvStore } from "@voyant-travel/utils/tiered-kv"
import { createCloudWorkflowDriver } from "@voyant-travel/workflows/client"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator/in-memory"
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"

import type { FrameworkProviders } from "./composition-lazy.js"
import { type CreateVoyantAppConfig, createVoyantApp } from "./create-app.js"
import {
  resolveManagedCustomExtensions,
  resolveManagedCustomModules,
} from "./custom-source-resolution.js"
import type { VoyantGraphDeploymentRequirements } from "./deployment-graph.js"
import { lowerVoyantGraphActionsToActionLedgerRegistry } from "./graph-action-ledger.js"
import { type ManagedPlugin, resolveManagedPlugins } from "./plugin-resolution.js"
import {
  getVoyantProjectRequirements,
  resolveActiveModuleIds,
  toCreateVoyantAppProfileConfig,
  type VoyantProfileEnvRequirement,
  type VoyantProfileRequirements,
  type VoyantProjectDeploymentMode,
  type VoyantProjectManifest,
  type VoyantProjectProviders,
  validateVoyantProject,
} from "./profile.js"
import { composeVoyantGraphRuntimeFacetModules } from "./runtime-composition.js"
import { registerVoyantGraphTools, type VoyantGraphRuntime } from "./runtime-lowering.js"
import {
  type ResolvedVoyantGraphRuntimeValues,
  resolveVoyantGraphRuntimeValues,
} from "./runtime-values.js"

export {
  type ResolveManagedCustomSourceOptions,
  resolveManagedCustomExtensions,
  resolveManagedCustomModules,
} from "./custom-source-resolution.js"

export {
  type ManagedPlugin,
  type ResolveManagedPluginsOptions,
  resolveManagedPlugins,
  type VoyantManagedPluginContext,
  type VoyantManagedPluginFactory,
} from "./plugin-resolution.js"

export interface ManagedProfileRuntimeEnv extends VoyantBindings {
  TENANT_ID?: string
  DATABASE_URL_DIRECT?: string
  DATABASE_URL_REPLICAS?: string
  R2_S3_ENDPOINT?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_BUCKET_MEDIA?: string
  R2_BUCKET_DOCUMENTS?: string
  MEDIA_BUCKET?: R2BucketShim
  DOCUMENTS_BUCKET?: R2BucketShim
  MEDIA_PUBLIC_BASE_URL?: string
  API_BASE_URL?: string
  REDIS_URL?: string
  RATE_LIMIT_STORE?: import("@voyant-travel/hono").RateLimitStore
  EMAIL_FROM?: string
  EMAIL_REPLY_TO?: string
  PUBLIC_CHECKOUT_BASE_URL?: string
  VOYANT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CLOUD_API_URL?: string
  VOYANT_CONNECT_API_KEY?: string
  VOYANT_CONNECT_OPERATOR_ID?: string
  VOYANT_CONNECT_API_URL?: string
  VOYANT_DATA_API_KEY?: string
  TYPESENSE_HOST?: string
  TYPESENSE_ADMIN_API_KEY?: string
  TYPESENSE_API_KEY?: string
  VOYANT_ADMIN_AUTH_MODE?: string
  VOYANT_CLOUD_DEPLOYMENT_ID?: string
  VOYANT_CLOUD_ADMIN_AUTH_START_URL?: string
  VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL?: string
  VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL?: string
  VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL?: string
  VOYANT_CLOUD_ADMIN_AUTH_AUDIENCE?: string
  VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN?: string
  SESSION_CLAIMS_SECRET?: string
  BETTER_AUTH_SECRET?: string
  VOYANT_CLOUD_WORKFLOWS_URL?: string
  VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN?: string
  VOYANT_CLOUD_APP_SLUG?: string
  VOYANT_CLOUD_ENVIRONMENT?: "production" | "preview" | "development"
  BANK_TRANSFER_BANK_NAME?: string
  BANK_TRANSFER_BENEFICIARY?: string
  BANK_TRANSFER_IBAN?: string
  BANK_TRANSFER_NOTES?: string
  STOREFRONT_BANK_BENEFICIARY?: string
  STOREFRONT_BANK_IBAN?: string
  STOREFRONT_BANK_NAME?: string
  ORIGIN_TRUST_SECRET?: string
  PORT?: string
}

type ManagedProfileAppModules = Record<string, ModuleFactory<FrameworkProviders>>
type ManagedProfileAppExtensions = Record<string, ExtensionFactory<FrameworkProviders>>

export interface ManagedProfileRuntimeOptions {
  profileSnapshotPath: string
  /**
   * Resolved deployment mode and providers supplied by a checked graph artifact.
   * Omit this only for legacy snapshot-only callers.
   */
  deployment?: ManagedProfileRuntimeDeployment
  /**
   * Resolved deployment requirements supplied by a checked graph artifact.
   * Omit this only for legacy snapshot-only callers.
   */
  deploymentRequirements?: VoyantGraphDeploymentRequirements
  /** Admitted generated runtime for graph-owned tools and other executable facets. */
  graphRuntime?: VoyantGraphRuntime
  /** Host implementations for graph-selected package runtime ports. */
  runtimePorts?: import("./runtime-composition.js").VoyantGraphRuntimePorts
  env?: Record<string, unknown> | ManagedProfileRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedProfileRuntimeEnv>
  providers?: Partial<FrameworkProviders>
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<ManagedProfileRuntimeEnv, FrameworkProviders>,
      "providers" | "exclude"
    >
  >
  /**
   * Override how snapshot `plugins` specifiers are imported. Defaults to dynamic
   * `import()`; injectable so Cloud (or tests) can resolve plugins from a
   * pre-bundled registry instead of node resolution.
   */
  importPluginModule?: (specifier: string) => Promise<Record<string, unknown>>
  /**
   * Override how snapshot `customSource.modules` and `customSource.extensions`
   * specifiers are imported. Defaults to dynamic `import()`; injectable so Cloud
   * (or tests) can resolve custom source packages from a pre-bundled registry
   * instead of node resolution.
   */
  importCustomSourceModule?: (specifier: string) => Promise<Record<string, unknown>>
}

export interface ManagedProfileRuntimeDeployment {
  mode: VoyantProjectDeploymentMode
  providers: VoyantProjectProviders
}

export interface ManagedProfileRuntime {
  project: VoyantProjectManifest
  requirements: VoyantProfileRequirements
  env: ManagedProfileRuntimeEnv
  graphValues?: ResolvedVoyantGraphRuntimeValues
  app: ReturnType<typeof createManagedProfileApp>
  actionLedgerCapabilities: ActionLedgerCapabilityRegistry
  fetch: (
    request: Request,
    env?: ManagedProfileRuntimeEnv,
    ctx?: ExecutionContextLike,
  ) => Response | Promise<Response>
  start: (options?: Partial<CreateNodeServerOptions<ManagedProfileRuntimeEnv>>) => NodeServerHandle
}

type AsyncMethodProvider<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never
}

interface DestinationNameResolver {
  resolve(code: string): Promise<string | null | undefined>
}

let pooledDb: { url: string; db: VoyantDb } | undefined
let managedSourceAdapterRegistry: SourceAdapterRegistry | undefined
let managedOwnedBookingHandlers: OwnedBookingHandlerRegistry | undefined
const MANAGED_CLOUD_BETTER_AUTH_ALLOWLIST = new Set([
  "/auth/get-session",
  "/auth/jwks",
  "/auth/session",
  "/auth/sign-out",
  "/auth/token",
])
const MANAGED_CLOUD_AUTH_REQUIRED_ENV = [
  "VOYANT_CLOUD_DEPLOYMENT_ID",
  "VOYANT_CLOUD_ADMIN_AUTH_START_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN",
  "SESSION_CLAIMS_SECRET",
  "BETTER_AUTH_SECRET",
] as const
const MANAGED_FULL_ACCESS_SCOPES = ["*"]
const DEFAULT_MANAGED_APP_URL = "http://localhost:3300"

interface ManagedSharedStores {
  CACHE: KVStore
  RATE_LIMIT: KVStore
  RATE_LIMIT_STORE: import("@voyant-travel/hono").RateLimitStore
}

export async function loadManagedProfileRuntime(
  options: ManagedProfileRuntimeOptions,
): Promise<ManagedProfileRuntime> {
  const project = applyManagedRuntimeDeployment(
    await loadManagedProfileSnapshot(options.profileSnapshotPath),
    options.deployment,
  )
  const env = createManagedProfileNodeEnv(options.env ?? process.env)
  const profileRequirements = getVoyantProjectRequirements(project)
  const requirements: VoyantProfileRequirements = {
    ...profileRequirements,
    ...(options.deploymentRequirements
      ? { resources: options.deploymentRequirements.resources }
      : {}),
  }
  const graphValues = options.graphRuntime
    ? await resolveVoyantGraphRuntimeValues(options.graphRuntime, {
        deploymentValues: toPluginEnvRecord(env),
        deploymentValueAliases: deploymentValueAliases(requirements),
      })
    : undefined
  const auth = resolveManagedProfileAuthIntegration({
    env,
    auth: options.app?.auth ?? options.auth,
    activeModules: resolveActiveModuleIds(project),
  })
  const plugins = await resolveManagedPlugins(
    project,
    toPluginEnvRecord(env),
    options.importPluginModule ? { importModule: options.importPluginModule } : {},
  )
  const customSourceOptions = options.importCustomSourceModule
    ? { importModule: options.importCustomSourceModule }
    : {}
  const customModules = await resolveManagedCustomModules(
    project,
    toPluginEnvRecord(env),
    customSourceOptions,
  )
  const graphFacetModules = options.graphRuntime
    ? await composeVoyantGraphRuntimeFacetModules(options.graphRuntime, options.runtimePorts)
    : []
  const actionLedgerCapabilities = options.graphRuntime
    ? lowerVoyantGraphActionsToActionLedgerRegistry(options.graphRuntime)
    : createActionLedgerCapabilityRegistry([])
  for (const [index, module] of graphFacetModules.entries()) {
    customModules[`graph-runtime:${index}:${module.module.name}`] = () => module
  }
  const customExtensions = await resolveManagedCustomExtensions(
    project,
    toPluginEnvRecord(env),
    customSourceOptions,
  )
  assertManagedProfileRuntimeSupport({
    project,
    requirements,
    env,
    hasAuthIntegration: Boolean(auth),
    hasResolvedPlugins: plugins.length > 0,
    hasResolvedCustomModules: Object.keys(customModules).length > 0,
    hasResolvedCustomExtensions: Object.keys(customExtensions).length > 0,
  })
  const app = createManagedProfileApp({
    project,
    env,
    auth,
    providers: options.providers,
    app: options.app,
    plugins,
    modules: customModules,
    extensions: customExtensions,
    graphRuntime: options.graphRuntime,
  })

  return {
    project,
    requirements,
    env,
    ...(graphValues ? { graphValues } : {}),
    app,
    actionLedgerCapabilities,
    fetch: (request, bindings = env, ctx = createNoopExecutionContext()) =>
      app.fetch(request, bindings, toHonoExecutionContext(ctx)),
    start: (serverOptions = {}) =>
      createNodeServer<ManagedProfileRuntimeEnv>({
        fetch: (request, bindings, ctx) =>
          app.fetch(request, bindings, toHonoExecutionContext(ctx)),
        env,
        port: Number.parseInt(env.PORT ?? "8080", 10),
        ...(env.ORIGIN_TRUST_SECRET ? { originTrustSecret: env.ORIGIN_TRUST_SECRET } : {}),
        ...serverOptions,
      }),
  }
}

function deploymentValueAliases(
  requirements: Pick<VoyantGraphDeploymentRequirements, "resources"> | undefined,
): Record<string, string[]> {
  const aliases: Record<string, string[]> = {}
  for (const resource of requirements?.resources ?? []) {
    for (const requirement of resource.env) {
      if (!requirement.aliases?.length) continue
      aliases[requirement.name] = [
        ...new Set([...(aliases[requirement.name] ?? []), ...requirement.aliases]),
      ]
    }
  }
  return aliases
}

export async function startManagedProfileRuntime(
  options: ManagedProfileRuntimeOptions & {
    server?: Partial<CreateNodeServerOptions<ManagedProfileRuntimeEnv>>
  },
): Promise<NodeServerHandle> {
  const runtime = await loadManagedProfileRuntime(options)
  return runtime.start(options.server)
}

export async function loadManagedProfileSnapshot(
  profileSnapshotPath: string,
): Promise<VoyantProjectManifest> {
  const raw = await readFile(profileSnapshotPath, "utf8")
  const parsed = JSON.parse(raw) as unknown
  const validation = validateVoyantProject(parsed)
  if (!validation.ok) {
    throw new Error(
      `Invalid managed profile snapshot:\n${validation.issues
        .map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`)
        .join("\n")}`,
    )
  }
  return parsed as VoyantProjectManifest
}

function applyManagedRuntimeDeployment(
  snapshot: VoyantProjectManifest,
  deployment: ManagedProfileRuntimeDeployment | undefined,
): VoyantProjectManifest {
  if (!deployment) return snapshot

  const { providers: _snapshotProviders, ...projectWithoutSnapshotProviders } = snapshot
  const project: VoyantProjectManifest = {
    ...projectWithoutSnapshotProviders,
    mode: deployment.mode,
    ...(deployment.mode === "managed-cloud" ? {} : { providers: deployment.providers }),
  }
  const validation = validateVoyantProject(project)
  if (!validation.ok) {
    throw new Error(
      `Invalid graph runtime deployment:\n${validation.issues
        .map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`)
        .join("\n")}`,
    )
  }
  return project
}

export function createManagedProfileApp(options: {
  project: VoyantProjectManifest
  env?: ManagedProfileRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedProfileRuntimeEnv>
  providers?: Partial<FrameworkProviders>
  graphRuntime?: VoyantGraphRuntime
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<ManagedProfileRuntimeEnv, FrameworkProviders>,
      "providers" | "exclude"
    >
  >
  /**
   * Plugins resolved from the snapshot's `plugins` list (see
   * {@link resolveManagedPlugins}), merged after any `app.plugins`. When the
   * snapshot declares plugins, either these or `app.plugins` must be non-empty.
   */
  plugins?: ManagedPlugin[]
  /**
   * Module factories resolved from the snapshot's `customSource.modules` list
   * (see {@link resolveManagedCustomModules}), merged after any `app.modules`.
   * When the snapshot declares custom modules, either these or `app.modules`
   * must be non-empty.
   */
  modules?: ManagedProfileAppModules
  /**
   * Extension factories resolved from the snapshot's `customSource.extensions`
   * list (see {@link resolveManagedCustomExtensions}), merged after any
   * `app.extensions`. When the snapshot declares custom extensions, either these
   * or `app.extensions` must be non-empty.
   */
  extensions?: ManagedProfileAppExtensions
}) {
  const auth = resolveManagedProfileAuthIntegration({
    env: options.env,
    auth: options.app?.auth ?? options.auth,
    activeModules: resolveActiveModuleIds(options.project),
  })
  const mergedPlugins = [...(options.app?.plugins ?? []), ...(options.plugins ?? [])]
  const mergedModules: ManagedProfileAppModules = {
    ...(options.app?.modules ?? {}),
    ...(options.modules ?? {}),
  }
  const mergedExtensions: ManagedProfileAppExtensions = {
    ...(options.app?.extensions ?? {}),
    ...(options.extensions ?? {}),
  }
  assertManagedProfileAppSupport({
    project: options.project,
    hasAuthIntegration: Boolean(auth),
    hasResolvedPlugins: mergedPlugins.length > 0,
    hasResolvedCustomModules: Object.keys(mergedModules).length > 0,
    hasResolvedCustomExtensions: Object.keys(mergedExtensions).length > 0,
  })
  const bridge = toCreateVoyantAppProfileConfig(options.project)
  return createVoyantApp<ManagedProfileRuntimeEnv, FrameworkProviders>({
    db: dbFromEnvForApp,
    dbTransactional: dbFromEnvForApp,
    outbox: true,
    workflows: {
      driver: (bindings) =>
        createManagedProfileWorkflowDriver(
          bindings as ManagedProfileRuntimeEnv,
          options.project.profile,
        ),
      environment: options.env?.VOYANT_CLOUD_ENVIRONMENT ?? "development",
      projectId: options.env?.VOYANT_CLOUD_APP_SLUG ?? options.project.profile,
    },
    ...options.app,
    // Managed integration bundles are registered like a starter's inline
    // `plugins: [...]`; core plugins (subscribers/workflows) and Hono bundles
    // (routes) both flatten through `registerPlugins` at `createApp` boot.
    plugins: mergedPlugins as CreateVoyantAppConfig<
      ManagedProfileRuntimeEnv,
      FrameworkProviders
    >["plugins"],
    modules: mergedModules,
    extensions: mergedExtensions,
    basePath: options.app?.basePath ?? "/api",
    auth,
    exclude: bridge.exclude,
    providers: createManagedProfileProviders(options.providers, options.graphRuntime),
  })
}

export function createManagedProfileProviders(
  overrides: Partial<FrameworkProviders> = {},
  graphRuntime?: VoyantGraphRuntime,
): FrameworkProviders {
  let providers: FrameworkProviders
  const defaults: FrameworkProviders = {
    resolveNotificationProviders: resolveManagedNotificationProviders,
    resolvePublicCheckoutBaseUrl: resolvePublicCheckoutBaseUrl,
    resolveDocumentDownloadUrl: resolveDocumentDownloadUrl,
    readDocumentContentBase64: readDocumentContentBase64,
    resolveDb: resolveDb,
    createOperatorDocumentStorage: createDocumentStorage,
    resolveContractDocumentGenerator: () => undefined,
    createBookingPiiService: async () => null,
    autoGenerateContractOnConfirmed: {
      enabled: false,
      templateSlug: "customer-sales-agreement",
    },
    resolveBankTransferDetails,
    relationshipsService: lazyRelationshipsService(),
    closePaymentSchedulesForBooking: async () => {},
    recordCancellationFinancialSettlement: async () => null,
    resolveBookingRequirementsProductSnapshot: async () => null,
    resolveCatalogRuntime: resolveManagedCatalogRuntime,
    createInvoiceExchangeRateResolver: createInvoiceExchangeRateResolver,
    createInvoiceSettlementPollers: () => ({}),
    createTripsRoutesOptions: async () => ({}),
    withDb: async (bindings, operation) => operation(resolveDb(bindings)),
    storefrontIntakePersistence: createNoopStorefrontIntakePersistence(),
    resolvePaymentStarters: () => ({}),
    resolveCardPaymentStarter: () => null,
    loadFlightAdminRoutes: createManagedFlightAdminRoutes,
    loadMcpAdminRoutes: () => createManagedMcpAdminRoutes(graphRuntime),
    loadCatalogBookingRoutes: createManagedCatalogBookingRoutes,
    loadInventoryContentRoutes: createManagedInventoryContentRoutes,
    loadCruisesContentRoutes: createManagedCruisesContentRoutes,
    loadAccommodationsContentRoutes: createManagedAccommodationsContentRoutes,
    loadStorageRoutes: createManagedStorageRoutes,
    loadInventoryBrochureRoutes: createManagedInventoryBrochureRoutes,
    loadPaymentLinkRoutes: async () =>
      createManagedPaymentLinkRoutes(providers.resolveCardPaymentStarter),
    loadContractDocumentRoutes: async () => createManagedContractDocumentRoutes(),
    createBookingScheduleRoutesOptions: createManagedBookingScheduleRoutesOptions,
    loadBookingScheduleAdminRoutes: createManagedBookingScheduleAdminRoutes,
    loadPaymentPolicyPublicRoutes: createManagedPaymentPolicyPublicRoutes,
    loadQuoteVersionSnapshotRoutes: createManagedQuoteVersionSnapshotRoutes,
    loadBookingMaintenanceRoutes: createManagedBookingMaintenanceRoutes,
    loadActionLedgerHealthRoutes: createManagedActionLedgerHealthRoutes,
    loadProposalAdminRoutes: createManagedProposalAdminRoutes,
    loadProposalPublicRoutes: createManagedProposalPublicRoutes,
    loadCatalogOffersRoutes: createManagedCatalogOffersRoutes,
    loadCatalogCheckoutRoutes: createManagedCatalogCheckoutRoutes,
  }
  providers = { ...defaults, ...overrides }
  return providers
}

export function createManagedProfileNodeEnv(
  processEnv: Record<string, unknown> | ManagedProfileRuntimeEnv,
): ManagedProfileRuntimeEnv {
  const raw: Record<string, unknown> = Object.fromEntries(Object.entries(processEnv))
  const stringEnv = Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
  const stores = createManagedSharedStores(raw, stringEnv)
  return composeNodeEnv<ManagedProfileRuntimeEnv>(stringEnv, {
    kv: {
      CACHE: stores.CACHE,
      RATE_LIMIT: stores.RATE_LIMIT,
    },
    r2: {
      MEDIA_BUCKET: isR2Bucket(raw.MEDIA_BUCKET)
        ? raw.MEDIA_BUCKET
        : objectStore(stringEnv.R2_BUCKET_MEDIA, stringEnv),
      DOCUMENTS_BUCKET: isR2Bucket(raw.DOCUMENTS_BUCKET)
        ? raw.DOCUMENTS_BUCKET
        : objectStore(stringEnv.R2_BUCKET_DOCUMENTS, stringEnv),
    },
    extra: {
      RATE_LIMIT_STORE: stores.RATE_LIMIT_STORE,
    },
  })
}

function resolveManagedProfileAuthIntegration(options: {
  env?: ManagedProfileRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedProfileRuntimeEnv>
  /** Active module ids surfaced on `/auth/bootstrap-status` for admin gating (voyant#3063). */
  activeModules?: readonly string[]
}): VoyantAuthIntegration<ManagedProfileRuntimeEnv> | undefined {
  if (options.auth) return options.auth
  if (!isManagedVoyantCloudAuthMode(options.env)) return undefined
  return createManagedCloudAdminAuthIntegration(options.activeModules ?? [])
}

function createManagedCloudAdminAuthIntegration(
  activeModules: readonly string[],
): VoyantAuthIntegration<ManagedProfileRuntimeEnv> {
  return {
    handler: () => {
      const app = createManagedCloudAuthApp(activeModules)
      return {
        fetch: (request, env, ctx) => app.fetch(request, env, ctx as never),
      }
    },
    resolve: async ({ request, env, db }) => {
      const auth = createManagedBetterAuth(env, db)
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return null

      const revalidateConfig = getManagedCloudAuthRevalidateConfig(env)
      if (!revalidateConfig) return null

      try {
        const revalidation = await revalidateVoyantCloudAdminAuthSession({
          db: db as Parameters<typeof revalidateVoyantCloudAdminAuthSession>[0]["db"],
          sessionId: session.session.id,
          config: revalidateConfig,
        })
        if (!revalidation.ok) return null
      } catch (error) {
        console.error("[managed-auth/session] Cloud revalidation failed:", error)
        return null
      }

      return {
        userId: session.user.id,
        sessionId: session.session.id,
        organizationId: null,
        callerType: "session",
        actor: "staff",
        scopes: await resolveManagedCloudMemberScopes(db, session.user.id),
        email: session.user.email ?? null,
      }
    },
    validateApiKey: async ({ env, db, apiKey }) => {
      if (!isManagedVoyantCloudAuthMode(env)) return true

      const revalidateConfig = getManagedCloudAuthRevalidateConfig(env)
      if (!revalidateConfig) return false

      try {
        const revalidation = await revalidateVoyantCloudAdminAuthUser({
          db: db as Parameters<typeof revalidateVoyantCloudAdminAuthUser>[0]["db"],
          userId: apiKey.referenceId,
          config: revalidateConfig,
        })
        return revalidation.ok
      } catch (error) {
        console.error("[managed-auth/api-token] Cloud revalidation failed:", error)
        return false
      }
    },
    onUnauthorized: async ({ request, env }) => {
      if (!isManagedVoyantCloudAuthMode(env) || !shouldRedirectManagedCloudAdminRequest(request)) {
        return null
      }

      const config = getManagedCloudAuthStartConfig(env)
      if (!config) return null

      const start = await createCloudAdminAuthStart({
        requestUrl: request.url,
        next: managedRequestNextPath(request),
        config,
      })

      return new Response(null, {
        status: 302,
        headers: {
          Location: start.redirectUrl,
          "Set-Cookie": start.setCookie,
        },
      })
    },
  }
}

type ManagedAuthHonoEnv = { Bindings: ManagedProfileRuntimeEnv }

export function createManagedCloudAuthApp(
  activeModules: readonly string[] = [],
): Hono<ManagedAuthHonoEnv> {
  const auth = new Hono<ManagedAuthHonoEnv>()

  async function startCloudAuth(c: Context<ManagedAuthHonoEnv>) {
    if (!isManagedVoyantCloudAuthMode(c.env)) {
      return c.json({ error: "Not found" }, 404)
    }

    const config = getManagedCloudAuthStartConfig(c.env)
    if (!config) {
      return c.json({ error: "Voyant Cloud auth broker is not configured yet" }, 501)
    }

    try {
      const start = await createCloudAdminAuthStart({
        requestUrl: c.req.url,
        next: c.req.query("next"),
        config,
      })
      return new Response(null, {
        status: 302,
        headers: {
          Location: start.redirectUrl,
          "Set-Cookie": start.setCookie,
        },
      })
    } catch (error) {
      console.error("[managed-auth/cloud/start] Error:", error)
      return c.json({ error: "Voyant Cloud auth broker is misconfigured" }, 500)
    }
  }

  auth.get("/auth/cloud/start", startCloudAuth)
  auth.get("/auth/sign-in/cloud", startCloudAuth)

  auth.get("/auth/cloud/callback", async (c) => {
    if (!isManagedVoyantCloudAuthMode(c.env)) {
      return c.json({ error: "Not found" }, 404)
    }

    if (!getManagedCloudAuthExchangeConfig(c.env)) {
      const url = new URL(c.req.url)
      return c.json({ error: "Voyant Cloud auth exchange is not configured yet" }, 501, {
        "Set-Cookie": buildClearCloudAdminAuthStateCookie(
          url.protocol === "https:",
          url.pathname.replace(/\/callback$/, "") || "/auth/cloud",
        ),
      })
    }

    try {
      return await createManagedBetterAuth(c.env, resolveDb(c.env)).handler(c.req.raw)
    } catch (error) {
      console.error("[managed-auth/cloud/callback] Error:", error)
      return c.json({ error: "Voyant Cloud auth callback failed" }, 500)
    }
  })

  auth.get("/auth/me", async (c) => {
    const user = await resolveManagedCurrentUser(c.env, c.req.raw)
    if (!user) return c.json({ error: "unauthorized" }, 401)
    return c.json(user)
  })

  auth.get("/auth/bootstrap-status", async (c) => {
    return c.json(await resolveManagedBootstrapStatus(c.env, c.req.raw, activeModules))
  })

  auth.all("/auth/*", async (c) => {
    if (isManagedVoyantCloudAuthMode(c.env) && !isManagedCloudAllowedBetterAuthRoute(c.req.raw)) {
      return c.json({ error: "Local auth routes are disabled in Voyant Cloud auth mode" }, 404)
    }

    return await createManagedBetterAuth(c.env, resolveDb(c.env)).handler(c.req.raw)
  })

  return auth
}

/**
 * Shape returned by `GET /auth/me` for a source-free managed admin host —
 * mirrors the operator starter's `CurrentUser` so the packaged admin UI can
 * resolve its current user directly from the managed API.
 */
export type ManagedCurrentUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  locale: string
  timezone: string | null
  uiPrefs: Record<string, unknown> | null
  isSuperAdmin: boolean
  isSupportUser: boolean
  createdAt: string
  profilePictureUrl: string | null
}

export type ManagedBootstrapStatus = {
  hasUsers: boolean
  authMode: "local" | "voyant-cloud"
  /**
   * The active module ids for this deployment (voyant#3063). The source-free
   * managed admin — a shared, framework-version-tagged image — reads this to
   * gate its composition so it shows only the modules the profile activates,
   * instead of every module the image can compose. Always the resolved set the
   * API actually mounts (see {@link resolveActiveModuleIds}).
   */
  modules: string[]
}

async function resolveManagedCurrentUser(
  env: ManagedProfileRuntimeEnv,
  request: Request,
): Promise<ManagedCurrentUser | null> {
  const db = resolveDb(env)
  const betterAuth = createManagedBetterAuth(env, db)
  const session = await betterAuth.api.getSession({ headers: request.headers })
  if (!session) return null

  const [row] = await db
    .select({
      id: authUser.id,
      email: authUser.email,
      createdAt: authUser.createdAt,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      locale: userProfilesTable.locale,
      timezone: userProfilesTable.timezone,
      uiPrefs: userProfilesTable.uiPrefs,
      avatarUrl: userProfilesTable.avatarUrl,
      isSuperAdmin: userProfilesTable.isSuperAdmin,
      isSupportUser: userProfilesTable.isSupportUser,
    })
    .from(authUser)
    .leftJoin(userProfilesTable, eq(userProfilesTable.id, authUser.id))
    .where(eq(authUser.id, session.user.id))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    email: row.email ?? session.user.email ?? "",
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    locale: row.locale ?? "en",
    timezone: row.timezone ?? null,
    uiPrefs: (row.uiPrefs as ManagedCurrentUser["uiPrefs"]) ?? null,
    isSuperAdmin: row.isSuperAdmin ?? false,
    isSupportUser: row.isSupportUser ?? false,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    profilePictureUrl: row.avatarUrl ?? null,
  }
}

async function resolveManagedBootstrapStatus(
  env: ManagedProfileRuntimeEnv,
  _request: Request,
  activeModules: readonly string[],
): Promise<ManagedBootstrapStatus> {
  const modules = [...activeModules]
  if (isManagedVoyantCloudAuthMode(env)) {
    return { hasUsers: true, authMode: "voyant-cloud", modules }
  }

  const db = resolveDb(env)
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
  return { hasUsers: (row?.count ?? 0) > 0, authMode: "local", modules }
}

function createManagedBetterAuth(env: ManagedProfileRuntimeEnv, db: VoyantDb) {
  const cloudAuthExchange = isManagedVoyantCloudAuthMode(env)
    ? getManagedCloudAuthExchangeConfig(env)
    : null
  const authDb = db as NonNullable<Parameters<typeof createBetterAuth>[0]>["db"]
  const cloudAuthDb = db as Parameters<typeof createVoyantCloudAdminAuthPlugin>[0]["db"]

  return createBetterAuth({
    db: authDb,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: getManagedAuthBaseUrl(env),
    basePath: "/auth",
    trustedOrigins: getManagedTrustedOrigins(env),
    plugins: cloudAuthExchange
      ? [
          createVoyantCloudAdminAuthPlugin({
            db: cloudAuthDb,
            cookieSecret: env.SESSION_CLAIMS_SECRET ?? "",
            exchange: cloudAuthExchange,
          }),
        ]
      : undefined,
  })
}

function resolveManagedAdminAuthMode(
  env: ManagedProfileRuntimeEnv | undefined,
): "local" | "voyant-cloud" {
  const mode = env?.VOYANT_ADMIN_AUTH_MODE?.trim() || "local"
  if (mode === "local" || mode === "voyant-cloud") return mode

  console.error(
    `[managed-auth] Invalid VOYANT_ADMIN_AUTH_MODE="${mode}". Failing closed as voyant-cloud.`,
  )
  return "voyant-cloud"
}

function isManagedVoyantCloudAuthMode(env: ManagedProfileRuntimeEnv | undefined): boolean {
  return resolveManagedAdminAuthMode(env) === "voyant-cloud"
}

function getManagedCloudAuthStartConfig(env: ManagedProfileRuntimeEnv) {
  const deploymentId = env.VOYANT_CLOUD_DEPLOYMENT_ID?.trim()
  const cloudAuthStartUrl = env.VOYANT_CLOUD_ADMIN_AUTH_START_URL?.trim()
  const cookieSecret = env.SESSION_CLAIMS_SECRET?.trim()
  if (!deploymentId || !cloudAuthStartUrl || !cookieSecret) return null

  return {
    cloudAuthStartUrl,
    deploymentId,
    adminCallbackUrl: `${getManagedPublicApiBaseUrl(env)}/auth/cloud/callback`,
    cookieSecret,
    environment: env.VOYANT_CLOUD_ENVIRONMENT,
  }
}

function getManagedCloudAuthExchangeConfig(env: ManagedProfileRuntimeEnv) {
  const deploymentId = env.VOYANT_CLOUD_DEPLOYMENT_ID?.trim()
  const exchangeUrl = env.VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL?.trim()
  const assertionJwksUrl = env.VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL?.trim()
  const clientToken = env.VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN?.trim()
  if (!deploymentId || !exchangeUrl || !assertionJwksUrl || !clientToken) return null

  return {
    exchangeUrl,
    deploymentId,
    clientToken,
    assertionJwksUrl,
    assertionAudience: env.VOYANT_CLOUD_ADMIN_AUTH_AUDIENCE?.trim() || deploymentId,
  }
}

function getManagedCloudAuthRevalidateConfig(env: ManagedProfileRuntimeEnv) {
  const deploymentId = env.VOYANT_CLOUD_DEPLOYMENT_ID?.trim()
  const revalidateUrl = env.VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL?.trim()
  const clientToken = env.VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN?.trim()
  if (!deploymentId || !revalidateUrl || !clientToken) return null

  return {
    revalidateUrl,
    deploymentId,
    clientToken,
  }
}

async function resolveManagedCloudMemberScopes(db: VoyantDb, userId: string): Promise<string[]> {
  const [link] = await db
    .select({ scopes: cloudAuthUserLinks.scopes, roleSlug: cloudAuthUserLinks.roleSlug })
    .from(cloudAuthUserLinks)
    .where(eq(cloudAuthUserLinks.userId, userId))
    .limit(1)
  return link?.scopes ?? scopesForRole(link?.roleSlug) ?? MANAGED_FULL_ACCESS_SCOPES
}

function isManagedCloudAllowedBetterAuthRoute(request: Request): boolean {
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/+$/, "") || "/"
  return MANAGED_CLOUD_BETTER_AUTH_ALLOWLIST.has(pathname)
}

function shouldRedirectManagedCloudAdminRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false

  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/+$/, "") || "/"
  if (
    pathname === "/health" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/v1/") ||
    pathname.startsWith("/api/v1/")
  ) {
    return false
  }

  const accept = request.headers.get("accept") ?? ""
  return accept.includes("text/html")
}

function managedRequestNextPath(request: Request): string {
  const url = new URL(request.url)
  return `${url.pathname}${url.search}${url.hash}` || "/"
}

function getManagedAuthBaseUrl(env: ManagedProfileRuntimeEnv): string {
  const appUrl = getManagedAppUrl(env)
  try {
    const parsed = new URL(appUrl)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return appUrl
  }
}

function getManagedPublicApiBaseUrl(env: ManagedProfileRuntimeEnv): string {
  const candidate =
    env.API_BASE_URL?.trim() || env.APP_URL?.trim() || `${getManagedAppUrl(env)}/api`
  const normalized = normalizeManagedUrl(candidate)

  try {
    const parsed = new URL(normalized)
    if (parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/api"
      return normalizeManagedUrl(parsed.toString())
    }
  } catch {
    return normalized
  }

  return normalized
}

function getManagedTrustedOrigins(env: ManagedProfileRuntimeEnv): string[] {
  return Array.from(
    new Set(
      [
        env.APP_URL,
        env.DASH_BASE_URL,
        env.API_BASE_URL,
        ...(env.CORS_ALLOWLIST ?? "").split(","),
        getManagedAppUrl(env),
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).map(normalizeManagedUrl)
}

function getManagedAppUrl(env: ManagedProfileRuntimeEnv): string {
  const candidates = [
    env.APP_URL,
    env.DASH_BASE_URL,
    env.API_BASE_URL?.replace(/\/api\/?$/, ""),
    DEFAULT_MANAGED_APP_URL,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return normalizeManagedUrl(candidate)
    }
  }

  return DEFAULT_MANAGED_APP_URL
}

function normalizeManagedUrl(url: string): string {
  return url.trim().replace(/\/$/, "")
}

function createManagedSharedStores(
  raw: Record<string, unknown>,
  env: Record<string, string>,
): ManagedSharedStores {
  const injectedCache = isKvNamespace(raw.CACHE) ? raw.CACHE : undefined
  const injectedRateLimit = isKvNamespace(raw.RATE_LIMIT) ? raw.RATE_LIMIT : undefined
  const redisUrl = env.REDIS_URL?.trim()
  const dbUrlValue = env.DATABASE_URL_DIRECT?.trim() || env.DATABASE_URL?.trim()

  const l1Cache = createMemoryKvNamespace()
  const l1RateLimit = createMemoryKvNamespace()

  if (redisUrl) {
    const l2Cache = createRedisKvStore(redisUrl)
    const l2RateLimitKv = createRedisKvStore(redisUrl)
    return {
      CACHE: injectedCache ?? createTieredKvStore(l1Cache, l2Cache),
      RATE_LIMIT: injectedRateLimit ?? createTieredKvStore(l1RateLimit, l2RateLimitKv),
      RATE_LIMIT_STORE: createRedisRateLimitStore(redisUrl),
    }
  }

  if (dbUrlValue && isPostgresConnectionUrl(dbUrlValue)) {
    const runtimeEnv: ManagedProfileRuntimeEnv = {
      ...env,
      DATABASE_URL: env.DATABASE_URL ?? dbUrlValue,
    }
    const db = resolveDb(runtimeEnv)
    const l2Cache = createPostgresKvStore(db)
    const l2RateLimitKv = createPostgresKvStore(db)
    return {
      CACHE: injectedCache ?? createTieredKvStore(l1Cache, l2Cache),
      RATE_LIMIT: injectedRateLimit ?? createTieredKvStore(l1RateLimit, l2RateLimitKv),
      RATE_LIMIT_STORE: createPostgresFixedWindowRateLimitStore(db),
    }
  }

  return {
    CACHE: injectedCache ?? l1Cache,
    RATE_LIMIT: injectedRateLimit ?? l1RateLimit,
    RATE_LIMIT_STORE: createMemoryRateLimitStore(),
  }
}

function isPostgresConnectionUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"
  } catch {
    return false
  }
}

function assertManagedProfileRuntimeSupport(options: {
  project: VoyantProjectManifest
  requirements: VoyantProfileRequirements
  env: ManagedProfileRuntimeEnv
  hasAuthIntegration: boolean
  hasResolvedPlugins: boolean
  hasResolvedCustomModules: boolean
  hasResolvedCustomExtensions: boolean
}) {
  const issues = [
    ...managedProfileAppSupportIssues({
      project: options.project,
      hasAuthIntegration: options.hasAuthIntegration,
      hasResolvedPlugins: options.hasResolvedPlugins,
      hasResolvedCustomModules: options.hasResolvedCustomModules,
      hasResolvedCustomExtensions: options.hasResolvedCustomExtensions,
    }),
    ...managedProfileEnvIssues(options.requirements, options.env),
  ]
  if (issues.length > 0) {
    throw new Error(`Managed profile runtime is not ready to start:\n${formatIssues(issues)}`)
  }
}

function assertManagedProfileAppSupport(options: {
  project: VoyantProjectManifest
  hasAuthIntegration: boolean
  hasResolvedPlugins: boolean
  hasResolvedCustomModules: boolean
  hasResolvedCustomExtensions: boolean
}) {
  const issues = managedProfileAppSupportIssues(options)
  if (issues.length > 0) {
    throw new Error(`Managed profile app is not ready to start:\n${formatIssues(issues)}`)
  }
}

function managedProfileAppSupportIssues(options: {
  project: VoyantProjectManifest
  hasAuthIntegration: boolean
  hasResolvedPlugins: boolean
  hasResolvedCustomModules: boolean
  hasResolvedCustomExtensions: boolean
}): string[] {
  const { project } = options
  const issues: string[] = []
  if (project.plugins.length > 0 && !options.hasResolvedPlugins) {
    issues.push(
      `snapshot plugins were declared but not resolved by @voyant-travel/framework/managed-runtime: ${project.plugins.join(
        ", ",
      )}`,
    )
  }
  if ((project.customSource?.modules?.length ?? 0) > 0 && !options.hasResolvedCustomModules) {
    issues.push(
      `snapshot customSource.modules were declared but not resolved by @voyant-travel/framework/managed-runtime: ${project.customSource?.modules?.join(
        ", ",
      )}`,
    )
  }
  if ((project.customSource?.extensions?.length ?? 0) > 0 && !options.hasResolvedCustomExtensions) {
    issues.push(
      `snapshot customSource.extensions were declared but not resolved by @voyant-travel/framework/managed-runtime: ${project.customSource?.extensions?.join(
        ", ",
      )}`,
    )
  }
  if (project.mode === "managed-cloud" && !options.hasAuthIntegration) {
    issues.push(
      "managed-cloud profiles require VOYANT_ADMIN_AUTH_MODE=voyant-cloud with Cloud admin auth env, or an injected admin auth integration",
    )
  }
  return issues
}

function managedProfileEnvIssues(
  requirements: VoyantProfileRequirements,
  env: ManagedProfileRuntimeEnv,
): string[] {
  const issues: string[] = []
  for (const resource of requirements.resources) {
    for (const requirement of resource.env) {
      const values = [requirement.name, ...(requirement.aliases ?? [])]
        .map((name) => getEnvValue(env, name))
        .filter(hasValue)
      if (requirement.required && values.length === 0) {
        issues.push(
          `${requirement.kind} ${requirement.name} is required for ${resource.resourceKey}`,
        )
        continue
      }
      const format = requirement.format
      if (format && values.length > 0 && !values.every((value) => hasFormat(value, format))) {
        issues.push(
          `${requirement.kind} ${requirement.name} must be ${formatDescription(format)} for ${resource.resourceKey}`,
        )
      }
    }
  }
  if (isManagedVoyantCloudAuthMode(env)) {
    for (const name of MANAGED_CLOUD_AUTH_REQUIRED_ENV) {
      const value = getEnvValue(env, name)
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push(`managed-cloud auth ${name} is required for Voyant Cloud admin auth`)
      }
    }
  }
  return [...new Set(issues)]
}

function formatIssues(issues: readonly string[]): string {
  return issues.map((issue) => `- ${issue}`).join("\n")
}

function getEnvValue(env: ManagedProfileRuntimeEnv, name: string): unknown {
  return Reflect.get(env, name)
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
}

function hasFormat(
  value: unknown,
  format: NonNullable<VoyantProfileEnvRequirement["format"]>,
): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false
  try {
    const parsed = new URL(value)
    if (format === "postgres-url")
      return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"
    if (format === "redis-url") return parsed.protocol === "redis:" || parsed.protocol === "rediss:"
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function formatDescription(format: NonNullable<VoyantProfileEnvRequirement["format"]>): string {
  if (format === "postgres-url") return "a Postgres URL"
  if (format === "redis-url") return "a Redis URL"
  return "an HTTP(S) URL"
}

function dbUrl(env: ManagedProfileRuntimeEnv): string {
  const url = env.DATABASE_URL_DIRECT?.trim() || env.DATABASE_URL?.trim()
  if (!url) throw new Error("Managed profile runtime requires DATABASE_URL.")
  return url
}

function resolveDb(env: unknown): VoyantDb {
  const bindings = env as ManagedProfileRuntimeEnv
  const url = dbUrl(bindings)
  if (pooledDb?.url !== url) {
    const replicas = parseReplicaUrls(bindings.DATABASE_URL_REPLICAS, url)
    pooledDb = {
      url,
      db: createDbClient(url, {
        adapter: "node",
        ...(replicas.length > 0 ? { replicas } : {}),
      }) as VoyantDb,
    }
  }
  return pooledDb.db
}

function dbFromEnvForApp(env: ManagedProfileRuntimeEnv): VoyantDb {
  return resolveDb(env)
}

function parseReplicaUrls(raw: string | undefined, primaryUrl: string): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry !== primaryUrl)
}

function objectStore(
  bucket: string | undefined,
  env: Record<string, string | undefined>,
): R2BucketShim {
  if (env.R2_S3_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && bucket) {
    return createR2BucketShim({
      endpoint: env.R2_S3_ENDPOINT,
      bucket,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    })
  }
  return createMemoryR2Bucket()
}

function isKvNamespace(value: unknown): value is KvNamespaceShim {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    "put" in value &&
    "delete" in value
  )
}

function isR2Bucket(value: unknown): value is R2BucketShim {
  return typeof value === "object" && value !== null && "get" in value && "put" in value
}

function createStorageProvider(bucket: R2BucketLike | undefined, publicBaseUrl?: string) {
  if (!bucket) return null
  return createR2Provider({
    bucket,
    ...(publicBaseUrl ? { publicBaseUrl } : {}),
  })
}

function createDocumentStorage(bindings: unknown) {
  return createStorageProvider((bindings as ManagedProfileRuntimeEnv).DOCUMENTS_BUCKET)
}

function createMediaStorage(bindings: unknown) {
  const env = bindings as ManagedProfileRuntimeEnv
  const base = resolveManagedApiBaseUrl(env)
  return createStorageProvider(env.MEDIA_BUCKET, base ? `${base}/v1/admin/media/` : undefined)
}

function resolveManagedApiBaseUrl(env: ManagedProfileRuntimeEnv): string | null {
  const base = env.API_BASE_URL?.trim() || env.APP_URL?.trim()
  return base ? base.replace(/\/+$/, "") : null
}

async function readDocumentContentBase64(
  bindings: unknown,
  storageKey: string,
): Promise<string | null> {
  const object = await (bindings as ManagedProfileRuntimeEnv).DOCUMENTS_BUCKET?.get(storageKey)
  if (!object) return null
  return arrayBufferToBase64(await object.arrayBuffer())
}

async function resolveDocumentDownloadUrl(
  bindings: unknown,
  storageKey: string,
): Promise<string | null> {
  const env = bindings as ManagedProfileRuntimeEnv
  const base = env.API_BASE_URL?.trim() || env.APP_URL?.trim()
  if (!base) return null
  return `${base.replace(/\/+$/, "")}/v1/admin/documents/files/${encodeURIComponent(storageKey)}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64")
  }
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function resolvePublicCheckoutBaseUrl(bindings: unknown): string | null {
  const env = bindings as ManagedProfileRuntimeEnv
  return (
    env.PUBLIC_CHECKOUT_BASE_URL?.trim() ||
    env.DASH_BASE_URL?.trim() ||
    env.APP_URL?.trim().replace(/\/api\/?$/, "") ||
    null
  )
}

function resolveBankTransferDetails(bindings: unknown) {
  const env = bindings as ManagedProfileRuntimeEnv
  if (!env.BANK_TRANSFER_BENEFICIARY || !env.BANK_TRANSFER_IBAN) return null
  return {
    provider: "bank-transfer" as const,
    beneficiary: env.BANK_TRANSFER_BENEFICIARY,
    iban: env.BANK_TRANSFER_IBAN,
    bankName: env.BANK_TRANSFER_BANK_NAME ?? null,
    notes: env.BANK_TRANSFER_NOTES ?? null,
  }
}

function resolveManagedNotificationProviders(bindings: unknown) {
  const env = bindings as ManagedProfileRuntimeEnv
  const apiKey = env.VOYANT_API_KEY?.trim() || env.VOYANT_CLOUD_API_KEY?.trim()
  if (!apiKey) return []
  const cloud = getVoyantCloudClient(
    {
      VOYANT_CLOUD_API_KEY: apiKey,
      ...(env.VOYANT_CLOUD_API_URL ? { VOYANT_CLOUD_API_URL: env.VOYANT_CLOUD_API_URL } : {}),
    },
    { apiKey },
  )
  const from = env.EMAIL_FROM?.trim() || "Voyant <noreply@voyantcloud.app>"
  const replyTo = resolveEmailReplyTo(env.EMAIL_REPLY_TO)
  const providers: NotificationProvider[] = [
    createVoyantCloudEmailProvider({
      client: cloud,
      from,
      ...(replyTo ? { replyTo } : {}),
    }),
    createVoyantCloudSmsProvider({ client: cloud }),
  ]
  return providers
}

function resolveEmailReplyTo(value: string | undefined): string[] | null {
  if (!value) return null
  const addresses = value
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean)
  return addresses.length > 0 ? addresses : null
}

type ManagedMcpToolContext = ToolContext & {
  catalog: CatalogToolServices
  trips: TripsToolServices
  inventory: InventoryToolServices
  bookings: BookingsToolServices
  finance: FinanceToolServices
  quotes: QuotesToolServices
  relationships: RelationshipsToolServices
  notifications: NotificationsToolServices
}

type BookingContactRow = {
  contactFirstName?: string | null
  contactLastName?: string | null
  contactTaxId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactAddressLine1?: string | null
  contactAddressLine2?: string | null
  contactPostalCode?: string | null
  [key: string]: unknown
}

function resolveManagedCatalogRuntime(c: Context): CatalogSearchRuntime {
  return {
    indexer: undefined,
    embeddings: undefined,
    defaultScope: {
      locale: "en-GB",
      audience: c.var.actor === "staff" ? "staff" : (c.var.actor ?? "customer"),
      market: "default",
    },
  }
}

async function createManagedMcpAdminRoutes(graphRuntime?: VoyantGraphRuntime): Promise<Hono> {
  const registry = createToolRegistry()
  if (graphRuntime) await registerVoyantGraphTools(graphRuntime, registry)
  return createMcpHonoApp({ registry, buildContext: buildManagedToolContext })
}

function buildManagedToolContext(c: Context): ManagedMcpToolContext {
  const env = managedEnv(c)
  const actor = (c.var.actor ?? "staff") as ToolContext["actor"]
  const audience = (c.var.audience ?? actor) as ToolContext["audience"]
  return {
    db: c.var.db,
    actor,
    audience,
    tenantId: env.TENANT_ID ?? env.VOYANT_CLOUD_DEPLOYMENT_ID ?? "default",
    resolverScope: { locale: "en-GB", audience, market: "default", actor },
    catalog: createManagedCatalogToolServices(c),
    trips: createManagedTripsToolServices(c),
    inventory: createManagedInventoryToolServices(c),
    bookings: createManagedBookingsToolServices(c),
    finance: {
      listInvoices: (query) => financeService.listInvoices(c.var.db, query),
      getInvoiceById: (id) => financeService.getInvoiceById(c.var.db, id),
      voidInvoice: (id, input) => financeService.voidInvoice(c.var.db, id, input),
    },
    quotes: {
      listQuotes: (query) => quotesService.listQuotes(c.var.db, query),
      getQuoteById: (id) => quotesService.getQuoteById(c.var.db, id),
      acceptQuoteVersion: (quoteVersionId) =>
        quotesService.acceptQuoteVersion(c.var.db, quoteVersionId),
    },
    relationships: {
      listPeople: (query) => relationshipsService.listPeople(c.var.db, query),
      getPersonById: (id) => relationshipsService.getPersonById(c.var.db, id),
      listOrganizations: (query) => relationshipsService.listOrganizations(c.var.db, query),
      getOrganizationById: (id) => relationshipsService.getOrganizationById(c.var.db, id),
    },
    notifications: {
      listDeliveries: (query) => notificationsService.listDeliveries(c.var.db, query),
      getDeliveryById: (id) => notificationsService.getDeliveryById(c.var.db, id),
      sendTemplated: (input) =>
        notificationsService.sendNotification(
          c.var.db,
          createNotificationService(resolveManagedNotificationProviders(c.env)),
          { ...input, targetType: "other" },
        ),
    },
  }
}

function createManagedCatalogToolServices(c: Context): CatalogToolServices {
  const runtime = resolveManagedCatalogRuntime(c)
  return {
    async search({ slice, request }) {
      const indexer = runtime.indexer
      if (!indexer) {
        throw new ToolError(
          "Catalog search indexer is not configured for this managed runtime.",
          "PROVIDER_ERROR",
        )
      }
      if (request.mode === "keyword") return indexer.search(slice, request)

      try {
        return await executeSemanticSearch({
          adapter: indexer,
          slice,
          request,
        })
      } catch {
        const keywordRequest = {
          ...request,
          mode: "keyword" as const,
          query_embedding: undefined,
          query_embedding_model_id: undefined,
        }
        return indexer.search(slice, keywordRequest)
      }
    },
    async getEntry() {
      return null
    },
  }
}

function createManagedTripsToolServices(c: Context): TripsToolServices {
  return {
    createTrip: (input) => tripsService.createTrip(c.var.db, input),
    addComponent: (input) => tripsService.addComponent(c.var.db, input),
    removeComponent: (componentId) => tripsService.removeComponent(c.var.db, componentId),
    priceTrip: async () => {
      throw new Error("Trips price dependencies are not configured for this managed runtime")
    },
    reserveTrip: async () => {
      throw new Error("Trips reserve dependencies are not configured for this managed runtime")
    },
  }
}

function createManagedInventoryToolServices(c: Context): InventoryToolServices {
  return {
    listProducts: (query) => productsService.listProducts(c.var.db, query),
    getProductById: (id) => productsService.getProductById(c.var.db, id),
  }
}

function createManagedBookingsToolServices(c: Context): BookingsToolServices {
  const reveal = shouldRevealBookingPii({
    actor: c.var.actor,
    scopes: c.var.scopes,
    callerType: c.var.callerType,
    isInternalRequest: c.var.isInternalRequest,
    enforceRbac: isStaffRbacEnforced(c.env),
  })

  return {
    async listBookings(query) {
      const result = await bookingsService.listBookings(c.var.db, query)
      if (reveal) return result
      return redactBookingListResult(result)
    },
    async getBookingById(id) {
      const row = await bookingsService.getBookingById(c.var.db, id)
      if (reveal || !row) return row
      return redactBookingRow(row)
    },
  }
}

function redactBookingListResult<T>(result: T): T {
  if (!isRecord(result) || !Array.isArray(result.data)) return result
  return { ...result, data: result.data.map((row) => redactBookingRow(row)) }
}

function redactBookingRow<T>(row: T): T {
  if (!isRecord(row)) return row
  return redactBookingContact(row as BookingContactRow) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createInvoiceExchangeRateResolver(
  bindings: unknown,
): ResolveInvoiceExchangeRate | undefined {
  const env = bindings as ManagedProfileRuntimeEnv
  const apiKey = env.VOYANT_DATA_API_KEY?.trim() || env.VOYANT_API_KEY?.trim()
  if (!apiKey) return undefined
  return async (input) => {
    const { createVoyantDataFxExchangeRateResolver } = await import("@voyant-travel/finance")
    return createVoyantDataFxExchangeRateResolver({
      apiKey,
      baseUrl: env.VOYANT_CLOUD_API_URL,
    })(input)
  }
}

function createManagedProfileWorkflowDriver(env: ManagedProfileRuntimeEnv, defaultAppSlug: string) {
  if (env.VOYANT_CLOUD_WORKFLOWS_URL?.trim() && env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN?.trim()) {
    return () =>
      createCloudWorkflowDriver({
        env: {
          VOYANT_CLOUD_WORKFLOWS_URL: env.VOYANT_CLOUD_WORKFLOWS_URL,
          VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN,
          VOYANT_CLOUD_APP_SLUG: env.VOYANT_CLOUD_APP_SLUG ?? defaultAppSlug,
          VOYANT_CLOUD_ENVIRONMENT: env.VOYANT_CLOUD_ENVIRONMENT,
        },
      })
  }
  return createInMemoryDriver()
}

function lazyRelationshipsService(): FrameworkProviders["relationshipsService"] {
  let servicePromise: Promise<FrameworkProviders["relationshipsService"]> | undefined
  const load = async () => {
    servicePromise ??= import("@voyant-travel/relationships").then(
      (m) =>
        m.relationshipsService as AsyncMethodProvider<FrameworkProviders["relationshipsService"]>,
    )
    return servicePromise
  }
  return {
    getPersonById: async (...args) => (await load()).getPersonById(...args),
    getOrganizationById: async (...args) => (await load()).getOrganizationById(...args),
    loadPersonTravelSnapshot: async (...args) => (await load()).loadPersonTravelSnapshot(...args),
    upsertPersonFromContact: async (...args) => (await load()).upsertPersonFromContact(...args),
  }
}

function createNoopStorefrontIntakePersistence(): FrameworkProviders["storefrontIntakePersistence"] {
  return {
    findSignal: async () => null,
    createPerson: async () => null,
    createCustomerSignal: async () => null,
    updateCustomerSignal: async () => null,
    deleteCustomerSignal: async () => {},
    deletePerson: async () => {},
  }
}

function dbFromContext(c: Context): PostgresJsDatabase {
  return c.get("db") as PostgresJsDatabase
}

function managedEnv(c: Context): ManagedProfileRuntimeEnv {
  return (c.env ?? {}) as ManagedProfileRuntimeEnv
}

/**
 * Flatten the runtime env bag (string vars + provider bindings) into a plain
 * record for plugin factories to read secrets/connection config from. A real
 * mapper rather than a cast — the managed env has no index signature.
 */
function toPluginEnvRecord(env: ManagedProfileRuntimeEnv): Record<string, unknown> {
  return Object.fromEntries(Object.entries(env))
}

function connectApiKey(env: ManagedProfileRuntimeEnv): string | undefined {
  return env.VOYANT_API_KEY ?? env.VOYANT_CONNECT_API_KEY ?? env.VOYANT_CLOUD_API_KEY
}

const CATALOG_OFFERS_INDEX_LOOKUP_BATCH = 80
type ConnectRequestMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT"

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function resolveCatalogOffersConnectClient(c: Context): CatalogOffersConnectClient | null {
  const env = managedEnv(c)
  const apiKey = connectApiKey(env)
  const operatorId = env.VOYANT_CONNECT_OPERATOR_ID
  if (!apiKey || !operatorId) return null

  const options = {
    apiKey,
    operatorId,
    ...(env.VOYANT_CONNECT_API_URL ? { baseUrl: env.VOYANT_CONNECT_API_URL } : {}),
  }
  const client = createVoyantConnectClient(options)
  return {
    transport: {
      request: (path, init) =>
        client.transport.request<unknown>(path, {
          method: toConnectRequestMethod(init.method),
          ...(init.body !== undefined ? { body: toConnectRequestBody(init.body) } : {}),
          ...(init.unwrapData !== undefined ? { unwrapData: init.unwrapData } : {}),
        }),
    },
    accommodations: {
      getOnConnection: (connectionId, externalId, options) =>
        client.accommodations.getOnConnection(connectionId, externalId, options),
    },
    cruises: {
      getOnConnection: (connectionId, externalId) =>
        client.cruises.getOnConnection(connectionId, externalId),
      listSailingPricing: (connectionId, sailingRef) =>
        client.cruises.listSailingPricing(connectionId, sailingRef),
    },
  }
}

function toConnectRequestMethod(method: string): ConnectRequestMethod {
  const normalized = method.toUpperCase()
  switch (normalized) {
    case "DELETE":
    case "GET":
    case "PATCH":
    case "POST":
    case "PUT":
      return normalized
    default:
      throw new TypeError(`Unsupported Connect request method: ${method}`)
  }
}

function toConnectRequestBody(body: unknown): object | BodyInit | null {
  if (body === null || typeof body === "string") return body
  if (typeof body === "object") return body
  throw new TypeError("Catalog offers Connect requests must use object, string, or null bodies")
}

async function fetchCatalogOffersIndexFields(
  c: Context,
  ids: string[],
): Promise<Map<string, CatalogOffersIndexFields>> {
  const env = managedEnv(c)
  const out = new Map<string, CatalogOffersIndexFields>()
  const host = env.TYPESENSE_HOST
  const key = env.TYPESENSE_ADMIN_API_KEY ?? env.TYPESENSE_API_KEY
  if (!host || !key || ids.length === 0) return out

  const base = host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host}`
  const distinct = [...new Set(ids)]
  for (const batch of chunk(distinct, CATALOG_OFFERS_INDEX_LOOKUP_BATCH)) {
    const filter = `id:=[${batch.map((id) => `\`${id}\``).join(",")}]`
    const url =
      `${base}/collections/products__en-GB__staff__default/documents/search` +
      `?q=*&query_by=name&filter_by=${encodeURIComponent(filter)}&per_page=${batch.length}` +
      `&include_fields=id,name,thumbnailUrl,stars,destinations,countryCodes`
    try {
      const res = (await fetch(url, { headers: { "X-TYPESENSE-API-KEY": key } }).then((r) =>
        r.json(),
      )) as { hits?: Array<{ document?: CatalogOffersIndexFields & { id?: string } }> }
      for (const hit of res.hits ?? []) {
        if (hit.document?.id) out.set(hit.document.id, hit.document)
      }
    } catch {
      // Enrichment is best-effort; cards still render from the offer payload.
    }
  }
  return out
}

async function resolveCatalogOffersDynamicHotelIds(
  c: Context,
  destination: CatalogOffersSearchDestination,
  limit: number,
): Promise<string[]> {
  const env = managedEnv(c)
  const host = env.TYPESENSE_HOST
  const key = env.TYPESENSE_ADMIN_API_KEY ?? env.TYPESENSE_API_KEY
  if (!host || !key) return []

  const base = host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host}`
  const filters = ["supplyModel:=dynamic"]
  if (destination.countryCode) filters.push(`countryCodes:=[\`${destination.countryCode}\`]`)
  if (destination.city) filters.push(`destinations:=[\`${destination.city}\`]`)
  const filter = filters.join(" && ")
  const url =
    `${base}/collections/products__en-GB__staff__default/documents/search` +
    `?q=*&query_by=name&filter_by=${encodeURIComponent(filter)}` +
    `&per_page=${Math.min(limit, 250)}&include_fields=id`
  try {
    const res = (await fetch(url, { headers: { "X-TYPESENSE-API-KEY": key } }).then((r) =>
      r.json(),
    )) as { hits?: Array<{ document?: { id?: string } }> }
    return (res.hits ?? []).map((hit) => hit.document?.id).filter((id): id is string => Boolean(id))
  } catch {
    return []
  }
}

async function resolveCatalogOffersAirportLabels(
  c: Context,
  codes: string[],
): Promise<CatalogOffersAirportLabel[]> {
  const env = managedEnv(c)
  const sorted = [...new Set(codes)].sort()
  const apiKey = connectApiKey(env)
  if (!apiKey || sorted.length === 0) return sorted.map((code) => ({ code, label: code }))

  let resolver: DestinationNameResolver | null = null
  try {
    const { createDestinationNameResolver } = await import("@voyant-travel/plugin-voyant-connect")
    resolver = createDestinationNameResolver({ apiKey })
  } catch {
    resolver = null
  }

  return Promise.all(
    sorted.map(async (code) => {
      if (!resolver) return { code, label: code }
      try {
        const city = await resolver.resolve(code)
        return { code, label: city && city !== code ? `${city} (${code})` : code }
      } catch {
        return { code, label: code }
      }
    }),
  )
}

function createManagedCatalogOffersRouteOptions(): CatalogOffersRouteModuleOptions {
  return {
    resolveConnectClient: resolveCatalogOffersConnectClient,
    fetchIndexFields: fetchCatalogOffersIndexFields,
    resolveDynamicHotelIds: resolveCatalogOffersDynamicHotelIds,
    resolveAirportLabels: resolveCatalogOffersAirportLabels,
  }
}

async function createManagedCatalogBookingRoutes() {
  const app = new OpenAPIHono()
  mountPackageCatalogBookingRoutes(app, createManagedCatalogBookingRouteModuleOptions())
  return app
}

function createManagedCatalogBookingRouteModuleOptions(): CatalogBookingRouteModuleOptions {
  return {
    booking: {
      resolveDb: dbFromContext,
      resolveSourceRegistry: resolveManagedSourceAdapterRegistry,
      resolveOwnedHandlers: resolveManagedOwnedBookingHandlers,
      onDraftConsumedError: ({ error }) => {
        console.warn("[catalog-booking] markDraftConsumed failed:", error)
      },
    },
    resolveRegistry: resolveManagedSourceAdapterRegistry,
    getProductContent: (db, productId, scope, ctx) => getProductContent(db, productId, scope, ctx),
    listAvailabilitySlots: listManagedAvailabilitySlots,
    getOwnedProductById: getManagedOwnedProductById,
  }
}

async function createManagedInventoryContentRoutes() {
  const app = new OpenAPIHono()
  app.route(
    "/v1/admin/products",
    createProductContentRoutes({
      resolveRegistry: resolveManagedSourceAdapterRegistry,
      defaultAcceptMachineTranslated: false,
    }),
  )
  app.route(
    "/v1/public/products",
    createProductContentRoutes({
      resolveRegistry: resolveManagedSourceAdapterRegistry,
      defaultAcceptMachineTranslated: true,
    }),
  )
  return app
}

async function createManagedCruisesContentRoutes() {
  const app = new OpenAPIHono()
  app.route(
    "/v1/admin/cruises",
    createCruiseContentRoutes({
      resolveRegistry: resolveManagedSourceAdapterRegistry,
      defaultAcceptMachineTranslated: false,
      allowOwnedKeys: true,
    }),
  )
  app.route(
    "/v1/public/cruises",
    createCruiseContentRoutes({
      resolveRegistry: resolveManagedSourceAdapterRegistry,
      defaultAcceptMachineTranslated: true,
      allowOwnedKeys: true,
    }),
  )
  return app
}

async function createManagedAccommodationsContentRoutes() {
  const app = new OpenAPIHono()
  app.route(
    "/v1/admin/accommodations",
    createAccommodationContentRoutes({
      resolveRegistry: resolveManagedSourceAdapterRegistry,
      defaultAcceptMachineTranslated: false,
    }),
  )
  app.route(
    "/v1/public/accommodations",
    createAccommodationContentRoutes({
      resolveRegistry: resolveManagedSourceAdapterRegistry,
      defaultAcceptMachineTranslated: true,
    }),
  )
  return app
}

async function createManagedCatalogOffersRoutes() {
  const { createCatalogOffersAdminRoutes } = await import("@voyant-travel/catalog/offers")
  return createCatalogOffersAdminRoutes(createManagedCatalogOffersRouteOptions())
}

async function listManagedAvailabilitySlots(
  db: unknown,
  productId: string,
  todayIso: string,
  _scope: CatalogAvailabilitySlotsScope,
): Promise<SlotRow[]> {
  return (db as PostgresJsDatabase)
    .select({
      id: availabilitySlots.id,
      dateLocal: availabilitySlots.dateLocal,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      timezone: availabilitySlots.timezone,
      status: availabilitySlots.status,
      unlimited: availabilitySlots.unlimited,
      remainingPax: availabilitySlots.remainingPax,
      initialPax: availabilitySlots.initialPax,
      nights: availabilitySlots.nights,
      days: availabilitySlots.days,
    })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.productId, productId),
        eq(availabilitySlots.status, "open"),
        gte(availabilitySlots.dateLocal, todayIso),
      ),
    )
    .orderBy(asc(availabilitySlots.startsAt))
    .limit(60)
}

async function getManagedOwnedProductById(
  db: unknown,
  productId: string,
): Promise<{ name: string | null; description: string | null } | null> {
  const product = await productsService.getProductById(db as PostgresJsDatabase, productId)
  if (!product) return null
  return { name: product.name, description: product.description }
}

async function getManagedOwnedProductName(
  db: PostgresJsDatabase,
  entityModule: string,
  entityId: string,
): Promise<string | null> {
  if (entityModule !== "products") return null
  const { productsService } = await import("@voyant-travel/inventory")
  const product = await productsService.getProductById(db, entityId)
  return product?.name ?? null
}

async function resolveManagedCheckoutBankTransferInstructions(
  db: PostgresJsDatabase,
  env: Record<string, string | undefined>,
) {
  const [operatorProfile, paymentInstructions] = await Promise.all([
    getOperatorProfile(db),
    getOperatorPaymentInstructions(db),
  ])

  return {
    beneficiary:
      paymentInstructions?.bankTransferBeneficiary ||
      operatorProfile?.legalName ||
      operatorProfile?.name ||
      env.BANK_TRANSFER_BENEFICIARY ||
      env.STOREFRONT_BANK_BENEFICIARY ||
      "-",
    iban: paymentInstructions?.iban || env.BANK_TRANSFER_IBAN || env.STOREFRONT_BANK_IBAN || "-",
    bankName:
      paymentInstructions?.bank || env.BANK_TRANSFER_BANK_NAME || env.STOREFRONT_BANK_NAME || "-",
  }
}

async function createManagedCatalogCheckoutRoutes() {
  const { createCatalogCheckoutRoutes } = await import("@voyant-travel/commerce/checkout")
  return createCatalogCheckoutRoutes({
    resolveBookingTaxSettings,
    getOwnedProductName: getManagedOwnedProductName,
    resolveBankTransferInstructions: resolveManagedCheckoutBankTransferInstructions,
  })
}

async function createManagedQuoteVersionSnapshotRoutes() {
  const { createQuoteVersionSnapshotRoutes } = await import("@voyant-travel/quotes")
  return createQuoteVersionSnapshotRoutes({
    resolveDb: dbFromContext,
  })
}

async function createManagedProposalAdminRoutes() {
  return createQuoteProposalAdminRoutes(createManagedQuoteProposalRoutesOptions())
}

async function createManagedProposalPublicRoutes() {
  return createQuoteProposalPublicRoutes(createManagedQuoteProposalRoutesOptions())
}

function createManagedQuoteProposalRoutesOptions(): QuoteProposalRoutesOptions {
  return {
    resolveDb: dbFromContext,
    resolvePublicProposalBaseUrl: (c) => resolvePublicCheckoutBaseUrl(c.env),
    reserveTripDeps: createManagedReserveTripDeps,
    startCheckoutDeps: createManagedStartCheckoutDeps,
    cancelTripComponentsDeps: createManagedCancelTripComponentsDeps,
    resolveOperatorProfile: async (db) => {
      const operatorSettings = await getOperatorSettings(db)
      return operatorSettings ? toPublicOperatorSettings(operatorSettings) : null
    },
    recordPublicProposalFeedback: async (db, input, c) => {
      const activity = await db.transaction(async (tx) => {
        const row = await relationshipsService.createActivity(tx, {
          subject: "Customer requested proposal edits",
          type: "note",
          status: "done",
          completedAt: new Date().toISOString(),
          description: input.message,
        })
        if (!row) throw new Error("Failed to record proposal feedback activity")
        await relationshipsService.createActivityLink(tx, row.id, {
          entityType: "quote",
          entityId: input.quoteId,
          role: "primary",
        })
        return { id: row.id }
      })

      await getManagedEventBus(c)?.emit(
        "quote.proposal_feedback.requested",
        {
          quoteId: input.quoteId,
          quoteVersionId: input.quoteVersionId,
          activityId: activity.id,
          message: input.message,
          proposalUrl: input.proposalUrl,
        },
        { category: "domain", source: "route" },
      )

      return activity
    },
  }
}

function createManagedReserveTripDeps(): ReserveTripDeps {
  return {
    submitReservationPlan: async (input) => {
      const submitted = await submitBookingReservationPlan(
        {
          reservationPlanId: input.reservationPlan.id,
          idempotencyKey: input.idempotencyKey,
          origin: {
            source: "trips",
            tripEnvelopeId: input.envelope.id,
          },
          envelope: input.envelope,
          lines: input.components.map((component) => ({
            planLineId: component.componentId,
            componentId: component.componentId,
            kind: component.reservationKind,
            line: component.component,
          })),
        },
        {
          reserveCatalogBackedLine: async () => {
            throw new Error(
              "Managed proposal reservation requires a catalog-backed reserve adapter",
            )
          },
          reserveNonCatalogLine: async () => {
            throw new Error("Managed proposal reservation requires a non-catalog reserve adapter")
          },
          releaseReservedLine: async () => ({
            released: false,
            reason: "release_not_configured",
          }),
        },
      )

      return {
        reservationPlanId: submitted.reservationPlanId,
        status: submitted.status,
        reserved: submitted.reserved.map((item) => ({
          componentId: item.componentId,
          status: item.status,
          result: item.result,
        })),
        failures: submitted.failures,
        compensations: submitted.compensations,
        warnings: submitted.warnings,
      }
    },
  }
}

function createManagedStartCheckoutDeps(): StartCheckoutDeps {
  return {
    startComponentCheckout: async () => {
      throw new Error("Managed proposal checkout requires a payment checkout adapter")
    },
  }
}

function createManagedCancelTripComponentsDeps(): CancelTripComponentsDeps {
  return {
    previewComponentCancellation: async (input) => ({
      componentId: input.component.id,
      action: "staff_remediation",
      currentStatus: input.component.status,
      staffActionRequired: true,
      reason: "Managed proposal cancellation requires a component cancellation adapter",
    }),
    cancelComponent: async () => ({
      status: "failed",
      reason: "Managed proposal cancellation requires a component cancellation adapter",
    }),
  }
}

function getManagedEventBus(c: Context): EventBus | undefined {
  return (c.var as { eventBus?: EventBus }).eventBus
}

function createManagedBookingScheduleRoutesOptions(): BookingScheduleRoutesOptions {
  return {
    resolveDb: dbFromContext,
    resolveOperatorDefaultPaymentPolicy,
    resolveSupplierPolicy: resolveManagedSupplierPaymentPolicy,
    resolveCategoryPolicy: resolveManagedCategoryPaymentPolicy,
    resolveListingPolicy: resolveManagedListingPaymentPolicy,
    resolveListingPolicyForEntity: resolveManagedListingPaymentPolicyForEntity,
    resolveCategoryPolicyForEntity: resolveManagedCategoryPaymentPolicyForEntity,
    resolveSupplierPolicyForEntity: resolveManagedSupplierPaymentPolicyForEntity,
    stampPolicySourceOnBooking: async (db, bookingId, source) => {
      const { stampPolicySourceOnBooking } = await import("@voyant-travel/finance")
      await stampPolicySourceOnBooking(db, bookingId, source)
    },
    readPolicySourceFromInternalNotes,
  }
}

async function createManagedBookingScheduleAdminRoutes() {
  const { createBookingScheduleAdminRoutes } = await import("@voyant-travel/finance")
  return createBookingScheduleAdminRoutes(createManagedBookingScheduleRoutesOptions())
}

async function createManagedPaymentPolicyPublicRoutes() {
  const { createPaymentPolicyPublicRoutes } = await import("@voyant-travel/finance")
  return createPaymentPolicyPublicRoutes(createManagedBookingScheduleRoutesOptions())
}

async function resolveManagedSupplierPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [{ bookingSupplierStatuses }, { supplierServices, suppliers }] = await Promise.all([
    import("@voyant-travel/bookings/schema"),
    import("@voyant-travel/distribution"),
  ])
  const [row] = await db
    .select({ policy: suppliers.customerPaymentPolicy })
    .from(bookingSupplierStatuses)
    .innerJoin(supplierServices, eq(supplierServices.id, bookingSupplierStatuses.supplierServiceId))
    .innerJoin(suppliers, eq(suppliers.id, supplierServices.supplierId))
    .where(eq(bookingSupplierStatuses.bookingId, bookingId))
    .orderBy(asc(bookingSupplierStatuses.createdAt))
    .limit(1)

  return paymentPolicyOrNull(row?.policy)
}

async function resolveManagedCategoryPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [{ bookingItems }, { productCategories, productCategoryProducts }] = await Promise.all([
    import("@voyant-travel/bookings/schema"),
    import("@voyant-travel/inventory/schema"),
  ])
  const productRows = await db
    .select({ productId: bookingItems.productId })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))
  const productIds = productRows
    .map((row) => row.productId)
    .filter((id): id is string => Boolean(id))
  if (productIds.length === 0) return null

  const [row] = await db
    .select({ policy: productCategories.customerPaymentPolicy })
    .from(productCategoryProducts)
    .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
    .where(
      and(
        inArray(productCategoryProducts.productId, productIds),
        isNotNull(productCategories.customerPaymentPolicy),
      ),
    )
    .orderBy(asc(productCategoryProducts.sortOrder), asc(productCategoryProducts.createdAt))
    .limit(1)

  return paymentPolicyOrNull(row?.policy)
}

async function resolveManagedListingPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  return (
    (await resolveManagedAccommodationListingPaymentPolicy(db, bookingId)) ??
    resolveManagedProductListingPaymentPolicy(db, bookingId)
  )
}

async function resolveManagedAccommodationListingPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [{ bookingItems }, { ratePlans, stayBookingItems }] = await Promise.all([
    import("@voyant-travel/bookings/schema"),
    import("@voyant-travel/accommodations/schema"),
  ])
  const [row] = await db
    .select({ policy: ratePlans.customerPaymentPolicy })
    .from(stayBookingItems)
    .innerJoin(bookingItems, eq(bookingItems.id, stayBookingItems.bookingItemId))
    .innerJoin(ratePlans, eq(ratePlans.id, stayBookingItems.ratePlanId))
    .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(ratePlans.customerPaymentPolicy)))
    .orderBy(asc(stayBookingItems.createdAt))
    .limit(1)

  return paymentPolicyOrNull(row?.policy)
}

async function resolveManagedProductListingPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [{ bookingItems }, { products }] = await Promise.all([
    import("@voyant-travel/bookings/schema"),
    import("@voyant-travel/inventory/schema"),
  ])
  const [row] = await db
    .select({ policy: products.customerPaymentPolicy })
    .from(bookingItems)
    .innerJoin(products, eq(products.id, bookingItems.productId))
    .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(products.customerPaymentPolicy)))
    .orderBy(asc(bookingItems.createdAt))
    .limit(1)

  return paymentPolicyOrNull(row?.policy)
}

async function resolveManagedListingPaymentPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  if (ctx.entityModule === "accommodations" && ctx.ratePlanId) {
    const { ratePlans } = await import("@voyant-travel/accommodations/schema")
    const [row] = await db
      .select({ policy: ratePlans.customerPaymentPolicy })
      .from(ratePlans)
      .where(eq(ratePlans.id, ctx.ratePlanId))
      .limit(1)
    return paymentPolicyOrNull(row?.policy)
  }

  if (ctx.entityModule === "products") {
    const { products } = await import("@voyant-travel/inventory/schema")
    const [row] = await db
      .select({ policy: products.customerPaymentPolicy })
      .from(products)
      .where(eq(products.id, ctx.entityId))
      .limit(1)
    return paymentPolicyOrNull(row?.policy)
  }

  return null
}

async function resolveManagedCategoryPaymentPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  if (ctx.entityModule !== "products") return null
  const { productCategories, productCategoryProducts } = await import(
    "@voyant-travel/inventory/schema"
  )
  const [row] = await db
    .select({ policy: productCategories.customerPaymentPolicy })
    .from(productCategoryProducts)
    .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
    .where(
      and(
        eq(productCategoryProducts.productId, ctx.entityId),
        isNotNull(productCategories.customerPaymentPolicy),
      ),
    )
    .orderBy(asc(productCategoryProducts.sortOrder), asc(productCategoryProducts.createdAt))
    .limit(1)

  return paymentPolicyOrNull(row?.policy)
}

async function resolveManagedSupplierPaymentPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  if (ctx.entityModule !== "products") return null
  const [{ products }, { suppliers }] = await Promise.all([
    import("@voyant-travel/inventory/schema"),
    import("@voyant-travel/distribution"),
  ])
  const [product] = await db
    .select({ supplierId: products.supplierId })
    .from(products)
    .where(eq(products.id, ctx.entityId))
    .limit(1)
  if (!product?.supplierId) return null

  const [supplier] = await db
    .select({ policy: suppliers.customerPaymentPolicy })
    .from(suppliers)
    .where(eq(suppliers.id, product.supplierId))
    .limit(1)

  return paymentPolicyOrNull(supplier?.policy)
}

function paymentPolicyOrNull(value: unknown): PaymentPolicy | null {
  return value ? (value as PaymentPolicy) : null
}

async function createManagedActionLedgerHealthRoutes() {
  const [
    { createActionLedgerHealthRoutes },
    { checkBookingActionLedgerDrift },
    { checkFinanceActionLedgerDrift },
    { checkProductActionLedgerDrift },
  ] = await Promise.all([
    import("@voyant-travel/action-ledger/health"),
    import("@voyant-travel/bookings/action-ledger-drift"),
    import("@voyant-travel/finance/action-ledger-drift"),
    import("@voyant-travel/inventory/action-ledger-drift"),
  ])

  return createActionLedgerHealthRoutes({
    checkBookingDrift: checkBookingActionLedgerDrift,
    checkFinanceDrift: checkFinanceActionLedgerDrift,
    checkProductDrift: checkProductActionLedgerDrift,
  })
}

async function createManagedFlightAdminRoutes() {
  const [
    { createFlightAdminRoutes, createFlightOrderPaymentIntegration },
    { createOrderPaymentSessions },
  ] = await Promise.all([
    import("@voyant-travel/flights"),
    import("@voyant-travel/finance/order-payment-sessions"),
  ])

  return createFlightAdminRoutes({
    resolveAdapter: resolveManagedFlightAdapter,
    payment: createFlightOrderPaymentIntegration({
      orderPaymentSessions: createOrderPaymentSessions({ targetType: "flight_order" }),
    }),
  })
}

function resolveManagedFlightAdapter(): FlightConnectorAdapter {
  return managedFlightConnectorNotConfiguredAdapter
}

const managedFlightConnectorNotConfiguredAdapter: FlightConnectorAdapter = {
  capabilities: {
    provider: "unconfigured",
    declared: [],
  },
  searchFlights: rejectManagedFlightConnectorRequest,
  priceOffer: rejectManagedFlightConnectorRequest,
  bookFlight: rejectManagedFlightConnectorRequest,
  getOrder: rejectManagedFlightConnectorRequest,
  cancelOrder: rejectManagedFlightConnectorRequest,
}

async function rejectManagedFlightConnectorRequest(): Promise<never> {
  throw new Error(
    "Flight connector is not configured for this managed runtime. Override loadFlightAdminRoutes with a deployment flight connector.",
  )
}

async function createManagedPaymentLinkRoutes(
  resolveCardPaymentStarter: FrameworkProviders["resolveCardPaymentStarter"],
) {
  const { createPaymentLinkRoutes } = await import("@voyant-travel/storefront/payment-link")
  return createPaymentLinkRoutes({
    resolveBankTransferDetails: async (c) => {
      const details = resolveBankTransferDetails(c.env)
      if (!details) return null
      return {
        beneficiary: details.beneficiary,
        iban: details.iban,
        bankName: details.bankName,
      }
    },
    resolvePublicCheckoutBaseUrl: (c) => resolvePublicCheckoutBaseUrl(c.env),
    startCardPayment: (c, session) =>
      startManagedPaymentLinkCardPayment(c, session, resolveCardPaymentStarter),
    resolveTripData: resolveManagedPaymentLinkTripData,
  })
}

async function startManagedPaymentLinkCardPayment(
  c: Context,
  session: Parameters<PaymentLinkRoutesOptions["startCardPayment"]>[1],
  resolveCardPaymentStarter: FrameworkProviders["resolveCardPaymentStarter"],
): ReturnType<PaymentLinkRoutesOptions["startCardPayment"]> {
  const starter = resolveCardPaymentStarter?.(c.env) ?? null
  if (!starter) return { configured: false }

  const [first, ...rest] = (session.payerName ?? "").trim().split(/\s+/)
  const last = rest.length > 0 ? rest.join(" ") : "Customer"
  const result = await starter(c, {
    db: dbFromContext(c),
    sessionId: session.id,
    billing: {
      email: session.payerEmail ?? "tbd@example.com",
      phone: "0000000000",
      firstName: first || "Customer",
      lastName: last,
      city: "TBD",
      country: 642,
      state: "TBD",
      postalCode: "00000",
      details: "Pending - customer to confirm at payment.",
    },
    description: session.notes ?? `Payment ${session.id}`,
  })

  if (!result) return { configured: false }
  return { configured: true, redirectUrl: result.redirectUrl }
}

const resolveManagedPaymentLinkTripData: NonNullable<
  PaymentLinkRoutesOptions["resolveTripData"]
> = async (c, tripEnvelopeId, session) => {
  const [{ productMedia, products }, { tripsService }, { tripComponents, tripEnvelopes }] =
    await Promise.all([
      import("@voyant-travel/inventory/schema"),
      import("@voyant-travel/trips"),
      import("@voyant-travel/trips/schema"),
    ])
  const db = dbFromContext(c)

  const [envelope] = await db
    .select()
    .from(tripEnvelopes)
    .where(eq(tripEnvelopes.id, tripEnvelopeId))
    .limit(1)
  if (!envelope) return null

  if (session.status === "paid" && envelope.status !== "booked") {
    try {
      await tripsService.completeTripCheckout(db, {
        envelopeId: envelope.id,
        paymentSessionId: session.id,
        payload: {
          source: "payment_link_trip_summary_reconcile",
          amountCents: session.amountCents,
          currency: session.currency,
          provider: session.provider,
        },
      })
    } catch (err) {
      console.error("[trips] payment summary reconciliation failed", err)
    }
  }

  const components = await db
    .select()
    .from(tripComponents)
    .where(eq(tripComponents.envelopeId, tripEnvelopeId))
    .orderBy(asc(tripComponents.sequence), asc(tripComponents.createdAt))
  const visibleComponents = components.filter(
    (component) => component.status !== "removed" && component.status !== "cancelled",
  )
  const productIds = Array.from(
    new Set(
      visibleComponents
        .map((component) => component.entityId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  )

  const productNameById = new Map<string, string>()
  const mediaByProductId = new Map<string, { url: string; altText: string | null }>()
  if (productIds.length > 0) {
    const productRows = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.id, productIds))
    for (const row of productRows) productNameById.set(row.id, row.name)

    const mediaRows = await db
      .select({
        productId: productMedia.productId,
        url: productMedia.url,
        altText: productMedia.altText,
        isCover: productMedia.isCover,
        sortOrder: productMedia.sortOrder,
        mediaType: productMedia.mediaType,
      })
      .from(productMedia)
      .where(and(inArray(productMedia.productId, productIds), eq(productMedia.mediaType, "image")))
      .orderBy(asc(productMedia.productId), desc(productMedia.isCover), asc(productMedia.sortOrder))
    for (const row of mediaRows) {
      if (!mediaByProductId.has(row.productId)) {
        mediaByProductId.set(row.productId, { url: row.url, altText: row.altText })
      }
    }
  }

  return {
    envelope: { id: envelope.id, status: envelope.status },
    components: visibleComponents.map((component) => ({
      id: component.id,
      kind: component.kind,
      entityModule: component.entityModule,
      entityId: component.entityId,
      description: component.description,
      status: component.status,
      sequence: component.sequence,
      componentTotalAmountCents: component.componentTotalAmountCents,
      componentCurrency: component.componentCurrency,
      metadata: metadataRecord(component.metadata),
    })),
    productNameById,
    mediaByProductId,
  }
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

async function createManagedStorageRoutes() {
  const { createMediaRoutes } = await import("@voyant-travel/storage/routes")
  const app = new OpenAPIHono()
  app.route(
    "/",
    createMediaRoutes({
      resolveStorage: (c) => createMediaStorage(c.env),
      guessServedMimeType: guessMimeType,
      signVideoUploadTicket: createManagedVideoUploadTicket,
    }),
  )
  return app
}

async function createManagedInventoryBrochureRoutes() {
  const { createProductBrochureRoutes } = await import("@voyant-travel/inventory/routes-brochure")
  const app = new OpenAPIHono()
  app.route(
    "/v1/admin/products",
    createProductBrochureRoutes({
      resolveStorage: (c) => createMediaStorage(c.env),
      resolvePrinter: () => null,
    }),
  )
  return app
}

function createManagedVideoUploadTicket(
  c: Context,
  input: VideoUploadTicketRequest,
): Promise<unknown> {
  const env = c.env as ManagedProfileRuntimeEnv
  const apiKey = env.VOYANT_API_KEY?.trim() || env.VOYANT_CLOUD_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("Voyant Cloud video upload provider is not configured.")
  }
  const cloud = getVoyantCloudClient(
    {
      VOYANT_CLOUD_API_KEY: apiKey,
      ...(env.VOYANT_CLOUD_API_URL ? { VOYANT_CLOUD_API_URL: env.VOYANT_CLOUD_API_URL } : {}),
    },
    { apiKey },
  )
  return cloud.video.videos.createUpload(toCreateVideoUploadInput(input))
}

function toCreateVideoUploadInput(input: VideoUploadTicketRequest): CreateVideoUploadInput {
  const output: CreateVideoUploadInput = {
    fileSize: input.fileSize,
    maxDurationSeconds: input.maxDurationSeconds,
  }
  if (input.name !== undefined) output.name = input.name
  if (input.requireSignedUrls !== undefined) output.requireSignedUrls = input.requireSignedUrls
  if (input.allowedOrigins !== undefined) output.allowedOrigins = input.allowedOrigins
  if (input.thumbnailTimestampPct !== undefined) {
    output.thumbnailTimestampPct = input.thumbnailTimestampPct
  }
  if (input.meta !== undefined) output.meta = input.meta
  return output
}

async function createManagedBookingMaintenanceRoutes() {
  const { createBookingMaintenanceRoutes } = await import("@voyant-travel/commerce/checkout")
  return createBookingMaintenanceRoutes({
    resolveDb: dbFromContext,
    resolveBookingTaxSettings,
  })
}

async function createManagedContractDocumentRoutes() {
  return createContractDocumentRoutes({
    generateContract: (env, db, eventBus, bookingId, opts) =>
      managedContractDocumentService(env).generate(
        db as PostgresJsDatabase,
        eventBus as EventBus | undefined,
        bookingId,
        opts,
      ),
    previewContract: (env, db, bookingId) =>
      managedContractDocumentService(env).preview(db as PostgresJsDatabase, bookingId),
    resolveStorage: createDocumentStorage,
    guessMimeType,
  })
}

const MANAGED_CONTRACT_SERIES_NAME = "customer-contracts"

function managedContractDocumentService(env: unknown) {
  return createContractDocumentService({
    resolveGenerator: () => resolveManagedContractDocumentGenerator(env),
    autoGenerateOptions: {
      enabled: true,
      templateSlug: "customer-sales-agreement",
      scope: "customer",
      language: "en",
      seriesName: MANAGED_CONTRACT_SERIES_NAME,
      resolveVariables: buildManagedContractVariables(),
    },
    defaultSeriesName: MANAGED_CONTRACT_SERIES_NAME,
    resolveBindings: () => contractDocumentBindings(env),
    resolveBookingPiiService: () => null,
  })
}

function buildManagedContractVariables() {
  return buildContractVariableBindings({
    resolveOperatorProfile: (db) => getOperatorProfile(db),
    resolveOperatorPaymentInstructions: (db) => getOperatorPaymentInstructions(db),
  })
}

function contractDocumentBindings(env: unknown): Record<string, unknown> {
  const bindings = env as ManagedProfileRuntimeEnv
  return {
    APP_URL: bindings.APP_URL,
    DOCUMENTS_BASE_URL: bindings.API_BASE_URL ?? bindings.APP_URL,
  }
}

function resolveManagedContractDocumentGenerator(env: unknown) {
  const storage = createDocumentStorage(env)
  if (!storage) return null
  return (context: ContractDocumentGeneratorContext) =>
    createPdfContractDocumentGenerator({ storage })(context)
}

function guessMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "pdf":
      return "application/pdf"
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "gif":
      return "image/gif"
    case "webp":
      return "image/webp"
    case "svg":
      return "image/svg+xml"
    case "mp4":
      return "video/mp4"
    case "webm":
      return "video/webm"
    case "mov":
      return "video/quicktime"
    case "json":
      return "application/json"
    case "txt":
      return "text/plain"
    case "csv":
      return "text/csv"
    case "xml":
      return "application/xml"
    case "zip":
      return "application/zip"
    case "doc":
      return "application/msword"
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    case "xls":
      return "application/vnd.ms-excel"
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    default:
      return "application/octet-stream"
  }
}

function resolveManagedSourceAdapterRegistry(): SourceAdapterRegistry {
  managedSourceAdapterRegistry ??= createSourceAdapterRegistry()
  return managedSourceAdapterRegistry
}

function resolveManagedOwnedBookingHandlers(): OwnedBookingHandlerRegistry {
  managedOwnedBookingHandlers ??= createOwnedBookingHandlerRegistry()
  return managedOwnedBookingHandlers
}

function createNoopExecutionContext(): ExecutionContextLike {
  return { waitUntil: () => {} }
}

function toHonoExecutionContext(ctx: ExecutionContextLike) {
  return {
    waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise),
    passThroughOnException: () => ctx.passThroughOnException?.(),
    props: undefined,
  }
}
