// agent-quality: file-size exception -- this entry is the managed profile
// runtime composition boundary: profile validation, env binding assembly, and
// provider defaults stay together so Cloud boot behavior is auditable.
import { readFile } from "node:fs/promises"

import { OpenAPIHono } from "@hono/zod-openapi"
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
import { createDbClient } from "@voyant-travel/db"
import {
  type BookingScheduleRoutesOptions,
  type PaymentPolicy,
  type PaymentPolicyEntityContext,
  type ResolveInvoiceExchangeRate,
  readPolicySourceFromInternalNotes,
} from "@voyant-travel/finance"
import type { FlightConnectorAdapter } from "@voyant-travel/flights"
import type {
  LazyRoutesLoader,
  VoyantAuthIntegration,
  VoyantBindings,
  VoyantDb,
} from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import {
  type ContractDocumentGeneratorContext,
  createContractDocumentRoutes,
  createContractDocumentService,
  createPdfContractDocumentGenerator,
} from "@voyant-travel/legal"
import { buildContractVariableBindings } from "@voyant-travel/legal/contract-variables"
import {
  createVoyantCloudEmailProvider,
  createVoyantCloudSmsProvider,
  type NotificationProvider,
} from "@voyant-travel/notifications"
import {
  getOperatorPaymentInstructions,
  getOperatorProfile,
  resolveBookingTaxSettings,
  resolveOperatorDefaultPaymentPolicy,
} from "@voyant-travel/operator-settings"
import { createDestinationNameResolver } from "@voyant-travel/plugin-voyant-connect"
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
import { createCloudWorkflowDriver } from "@voyant-travel/workflows/client"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator/in-memory"
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"

import type { FrameworkProviders } from "./composition-lazy.js"
import { type CreateVoyantAppConfig, createVoyantApp } from "./create-app.js"
import {
  getVoyantProjectRequirements,
  toCreateVoyantAppProfileConfig,
  type VoyantProfileRequirements,
  type VoyantProjectManifest,
  validateVoyantProject,
} from "./profile.js"

export interface ManagedProfileRuntimeEnv extends VoyantBindings {
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

export interface ManagedProfileRuntimeOptions {
  profileSnapshotPath: string
  env?: Record<string, unknown> | ManagedProfileRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedProfileRuntimeEnv>
  providers?: Partial<FrameworkProviders>
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<ManagedProfileRuntimeEnv, FrameworkProviders>,
      "providers" | "exclude"
    >
  >
}

export interface ManagedProfileRuntime {
  project: VoyantProjectManifest
  requirements: VoyantProfileRequirements
  env: ManagedProfileRuntimeEnv
  app: ReturnType<typeof createManagedProfileApp>
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

let pooledDb: { url: string; db: VoyantDb } | undefined

export async function loadManagedProfileRuntime(
  options: ManagedProfileRuntimeOptions,
): Promise<ManagedProfileRuntime> {
  const project = await loadManagedProfileSnapshot(options.profileSnapshotPath)
  const env = createManagedProfileNodeEnv(options.env ?? process.env)
  const requirements = getVoyantProjectRequirements(project)
  assertManagedProfileRuntimeSupport({
    project,
    requirements,
    env,
    hasAuthIntegration: Boolean(options.auth ?? options.app?.auth),
  })
  const app = createManagedProfileApp({
    project,
    env,
    auth: options.auth,
    providers: options.providers,
    app: options.app,
  })

  return {
    project,
    requirements,
    env,
    app,
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

export function createManagedProfileApp(options: {
  project: VoyantProjectManifest
  env?: ManagedProfileRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedProfileRuntimeEnv>
  providers?: Partial<FrameworkProviders>
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<ManagedProfileRuntimeEnv, FrameworkProviders>,
      "providers" | "exclude"
    >
  >
}) {
  assertManagedProfileAppSupport({
    project: options.project,
    hasAuthIntegration: Boolean(options.auth ?? options.app?.auth),
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
    auth: options.auth,
    ...options.app,
    exclude: bridge.exclude,
    providers: createManagedProfileProviders(options.providers),
  })
}

export function createManagedProfileProviders(
  overrides: Partial<FrameworkProviders> = {},
): FrameworkProviders {
  const providers: FrameworkProviders = {
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
    resolveCatalogRuntime: (c) => ({
      indexer: undefined,
      embeddings: undefined,
      defaultScope: {
        locale: "en-GB",
        audience: c.var.actor === "staff" ? "staff" : (c.var.actor ?? "customer"),
        market: "default",
      },
    }),
    createInvoiceExchangeRateResolver: createInvoiceExchangeRateResolver,
    createInvoiceSettlementPollers: () => ({}),
    createTripsRoutesOptions: async () => ({}),
    storefrontIntakePersistence: createNoopStorefrontIntakePersistence(),
    resolvePaymentStarters: () => ({}),
    createChannelPushExtension: createEmptyChannelPushExtension,
    loadFlightAdminRoutes: createManagedFlightAdminRoutes,
    loadMcpAdminRoutes: emptyRoutes,
    loadCatalogBookingRoutes: emptyRoutes,
    loadCatalogContentRoutes: emptyRoutes,
    loadMediaRoutes: createManagedMediaRoutes,
    loadPaymentLinkRoutes: async () => createManagedPaymentLinkRoutes(),
    loadContractDocumentRoutes: async () => createManagedContractDocumentRoutes(),
    loadBookingScheduleAdminRoutes: createManagedBookingScheduleAdminRoutes,
    loadPaymentPolicyPublicRoutes: createManagedPaymentPolicyPublicRoutes,
    loadQuoteVersionSnapshotRoutes: createManagedQuoteVersionSnapshotRoutes,
    loadBookingMaintenanceRoutes: createManagedBookingMaintenanceRoutes,
    loadActionLedgerHealthRoutes: createManagedActionLedgerHealthRoutes,
    loadProposalAdminRoutes: emptyRoutes,
    loadProposalPublicRoutes: emptyRoutes,
    loadCatalogOffersRoutes: createManagedCatalogOffersRoutes,
    loadCatalogCheckoutRoutes: createManagedCatalogCheckoutRoutes,
  }
  return { ...providers, ...overrides }
}

export function createManagedProfileNodeEnv(
  processEnv: Record<string, unknown> | ManagedProfileRuntimeEnv,
): ManagedProfileRuntimeEnv {
  const raw: Record<string, unknown> = Object.fromEntries(Object.entries(processEnv))
  const stringEnv = Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
  return composeNodeEnv<ManagedProfileRuntimeEnv>(stringEnv, {
    kv: {
      CACHE: isKvNamespace(raw.CACHE) ? raw.CACHE : createMemoryKvNamespace(),
      RATE_LIMIT: isKvNamespace(raw.RATE_LIMIT) ? raw.RATE_LIMIT : createMemoryKvNamespace(),
    },
    r2: {
      MEDIA_BUCKET: isR2Bucket(raw.MEDIA_BUCKET)
        ? raw.MEDIA_BUCKET
        : objectStore(stringEnv.R2_BUCKET_MEDIA, stringEnv),
      DOCUMENTS_BUCKET: isR2Bucket(raw.DOCUMENTS_BUCKET)
        ? raw.DOCUMENTS_BUCKET
        : objectStore(stringEnv.R2_BUCKET_DOCUMENTS, stringEnv),
    },
  })
}

function assertManagedProfileRuntimeSupport(options: {
  project: VoyantProjectManifest
  requirements: VoyantProfileRequirements
  env: ManagedProfileRuntimeEnv
  hasAuthIntegration: boolean
}) {
  const issues = [
    ...managedProfileAppSupportIssues(options.project, options.hasAuthIntegration),
    ...managedProfileEnvIssues(options.requirements, options.env),
  ]
  if (issues.length > 0) {
    throw new Error(`Managed profile runtime is not ready to start:\n${formatIssues(issues)}`)
  }
}

function assertManagedProfileAppSupport(options: {
  project: VoyantProjectManifest
  hasAuthIntegration: boolean
}) {
  const issues = managedProfileAppSupportIssues(options.project, options.hasAuthIntegration)
  if (issues.length > 0) {
    throw new Error(`Managed profile app is not ready to start:\n${formatIssues(issues)}`)
  }
}

function managedProfileAppSupportIssues(
  project: VoyantProjectManifest,
  hasAuthIntegration: boolean,
): string[] {
  const issues: string[] = []
  if (project.plugins.length > 0) {
    issues.push(
      `snapshot plugins are not yet resolved by @voyant-travel/framework/managed-runtime: ${project.plugins.join(
        ", ",
      )}`,
    )
  }
  if (project.mode === "managed-cloud" && !hasAuthIntegration) {
    issues.push(
      "managed-cloud profiles require an injected admin auth integration until the Voyant Cloud auth broker is packaged in the managed runtime",
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
    if (resource.required && resource.provider === "redis") {
      issues.push(
        "Redis-backed CACHE/RATE_LIMIT bindings for REDIS_URL are not implemented in @voyant-travel/framework/managed-runtime yet",
      )
    }
    for (const requirement of resource.env) {
      if (!requirement.required) continue
      const value = getEnvValue(env, requirement.name)
      const present =
        typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
      if (!present) {
        issues.push(
          `${requirement.kind} ${requirement.name} is required for ${resource.resourceKey}`,
        )
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

  let resolver: ReturnType<typeof createDestinationNameResolver> | null = null
  try {
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

async function createManagedCatalogOffersRoutes() {
  const { createCatalogOffersAdminRoutes } = await import("@voyant-travel/catalog/offers")
  return createCatalogOffersAdminRoutes(createManagedCatalogOffersRouteOptions())
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

async function createManagedPaymentLinkRoutes() {
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
    startCardPayment: async () => ({ configured: false }),
    resolveTripData: resolveManagedPaymentLinkTripData,
  })
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

async function createManagedMediaRoutes() {
  const [{ createProductBrochureRoutes }, { createMediaRoutes }] = await Promise.all([
    import("@voyant-travel/inventory/routes-brochure"),
    import("@voyant-travel/storage/routes"),
  ])

  const app = new OpenAPIHono()
  app.route(
    "/",
    createMediaRoutes({
      resolveStorage: (c) => createMediaStorage(c.env),
      guessServedMimeType: guessMimeType,
      signVideoUploadTicket: createManagedVideoUploadTicket,
    }),
  )
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

const emptyRoutes: LazyRoutesLoader = async () => new Hono()

function createEmptyChannelPushExtension(): HonoExtension {
  return {
    extension: { name: "channel-push", module: "distribution" },
    lazyAdminRoutes: emptyRoutes,
  }
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
