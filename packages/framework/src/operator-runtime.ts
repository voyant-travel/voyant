import { readFile } from "node:fs/promises"

import { getVoyantCloudClient } from "@voyant-travel/cloud-sdk"
import { createDbClient } from "@voyant-travel/db"
import type { ResolveInvoiceExchangeRate } from "@voyant-travel/finance"
import type {
  LazyRoutesLoader,
  VoyantAuthIntegration,
  VoyantBindings,
  VoyantDb,
} from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import {
  createVoyantCloudEmailProvider,
  createVoyantCloudSmsProvider,
  type NotificationProvider,
} from "@voyant-travel/notifications"
import {
  type CreateNodeServerOptions,
  composeNodeEnv,
  createMemoryKvNamespace,
  createMemoryR2Bucket,
  createNodeServer,
  createR2BucketShim,
  type ExecutionContextLike,
  type NodeServerHandle,
  type R2BucketShim,
} from "@voyant-travel/runtime"
import { createR2Provider, type R2BucketLike } from "@voyant-travel/storage/providers/r2"
import { createCloudWorkflowDriver } from "@voyant-travel/workflows/client"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator/in-memory"
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

export interface ManagedOperatorRuntimeEnv extends VoyantBindings {
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
  EMAIL_FROM?: string
  EMAIL_REPLY_TO?: string
  PUBLIC_CHECKOUT_BASE_URL?: string
  VOYANT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CLOUD_API_URL?: string
  VOYANT_DATA_API_KEY?: string
  VOYANT_CLOUD_WORKFLOWS_URL?: string
  VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN?: string
  VOYANT_CLOUD_APP_SLUG?: string
  VOYANT_CLOUD_ENVIRONMENT?: "production" | "preview" | "development"
  BANK_TRANSFER_BANK_NAME?: string
  BANK_TRANSFER_BENEFICIARY?: string
  BANK_TRANSFER_IBAN?: string
  BANK_TRANSFER_NOTES?: string
  ORIGIN_TRUST_SECRET?: string
  PORT?: string
}

export interface ManagedOperatorRuntimeOptions {
  profileSnapshotPath: string
  env?: Record<string, string | undefined> | ManagedOperatorRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedOperatorRuntimeEnv>
  providers?: Partial<FrameworkProviders>
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<ManagedOperatorRuntimeEnv, FrameworkProviders>,
      "providers" | "exclude"
    >
  >
}

export interface ManagedOperatorRuntime {
  project: VoyantProjectManifest
  requirements: VoyantProfileRequirements
  env: ManagedOperatorRuntimeEnv
  app: ReturnType<typeof createManagedOperatorApp>
  fetch: (
    request: Request,
    env?: ManagedOperatorRuntimeEnv,
    ctx?: ExecutionContextLike,
  ) => Response | Promise<Response>
  start: (options?: Partial<CreateNodeServerOptions<ManagedOperatorRuntimeEnv>>) => NodeServerHandle
}

type AsyncMethodProvider<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never
}

let pooledDb: { url: string; db: VoyantDb } | undefined

export async function loadManagedOperatorRuntime(
  options: ManagedOperatorRuntimeOptions,
): Promise<ManagedOperatorRuntime> {
  const project = await loadManagedOperatorProfileSnapshot(options.profileSnapshotPath)
  const env = createManagedOperatorNodeEnv(options.env ?? process.env)
  const requirements = getVoyantProjectRequirements(project)
  const app = createManagedOperatorApp({
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
      createNodeServer<ManagedOperatorRuntimeEnv>({
        fetch: (request, bindings, ctx) =>
          app.fetch(request, bindings, toHonoExecutionContext(ctx)),
        env,
        port: Number.parseInt(env.PORT ?? "8080", 10),
        ...(env.ORIGIN_TRUST_SECRET ? { originTrustSecret: env.ORIGIN_TRUST_SECRET } : {}),
        ...serverOptions,
      }),
  }
}

export async function startManagedOperatorRuntime(
  options: ManagedOperatorRuntimeOptions & {
    server?: Partial<CreateNodeServerOptions<ManagedOperatorRuntimeEnv>>
  },
): Promise<NodeServerHandle> {
  const runtime = await loadManagedOperatorRuntime(options)
  return runtime.start(options.server)
}

export async function loadManagedOperatorProfileSnapshot(
  profileSnapshotPath: string,
): Promise<VoyantProjectManifest> {
  const raw = await readFile(profileSnapshotPath, "utf8")
  const parsed = JSON.parse(raw) as unknown
  const validation = validateVoyantProject(parsed)
  if (!validation.ok) {
    throw new Error(
      `Invalid managed operator profile snapshot:\n${validation.issues
        .map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`)
        .join("\n")}`,
    )
  }
  return parsed as VoyantProjectManifest
}

export function createManagedOperatorApp(options: {
  project: VoyantProjectManifest
  env?: ManagedOperatorRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedOperatorRuntimeEnv>
  providers?: Partial<FrameworkProviders>
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<ManagedOperatorRuntimeEnv, FrameworkProviders>,
      "providers" | "exclude"
    >
  >
}) {
  const bridge = toCreateVoyantAppProfileConfig(options.project)
  return createVoyantApp<ManagedOperatorRuntimeEnv, FrameworkProviders>({
    db: dbFromEnvForApp,
    dbTransactional: dbFromEnvForApp,
    outbox: true,
    workflows: {
      driver: (bindings) =>
        createManagedOperatorWorkflowDriver(bindings as ManagedOperatorRuntimeEnv),
      environment: options.env?.VOYANT_CLOUD_ENVIRONMENT ?? "development",
      projectId: options.env?.VOYANT_CLOUD_APP_SLUG ?? "operator",
    },
    auth: options.auth,
    ...options.app,
    exclude: bridge.exclude,
    providers: createManagedOperatorProviders(options.providers),
  })
}

export function createManagedOperatorProviders(
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
    loadFlightAdminRoutes: emptyRoutes,
    loadMcpAdminRoutes: emptyRoutes,
    loadCatalogBookingRoutes: emptyRoutes,
    loadCatalogContentRoutes: emptyRoutes,
    loadMediaRoutes: emptyRoutes,
    loadPaymentLinkRoutes: emptyRoutes,
    loadContractDocumentRoutes: emptyRoutes,
    loadBookingScheduleAdminRoutes: emptyRoutes,
    loadPaymentPolicyPublicRoutes: emptyRoutes,
    loadQuoteVersionSnapshotRoutes: emptyRoutes,
    loadBookingMaintenanceRoutes: emptyRoutes,
    loadActionLedgerHealthRoutes: emptyRoutes,
    loadProposalAdminRoutes: emptyRoutes,
    loadProposalPublicRoutes: emptyRoutes,
    loadCatalogOffersRoutes: emptyRoutes,
    loadCatalogCheckoutRoutes: emptyRoutes,
  }
  return { ...providers, ...overrides }
}

export function createManagedOperatorNodeEnv(
  processEnv: Record<string, string | undefined> | ManagedOperatorRuntimeEnv,
): ManagedOperatorRuntimeEnv {
  const raw = processEnv as Record<string, string | undefined>
  return composeNodeEnv<ManagedOperatorRuntimeEnv>(raw, {
    kv: {
      CACHE: createMemoryKvNamespace(),
      RATE_LIMIT: createMemoryKvNamespace(),
    },
    r2: {
      MEDIA_BUCKET: objectStore(raw.R2_BUCKET_MEDIA, raw),
      DOCUMENTS_BUCKET: objectStore(raw.R2_BUCKET_DOCUMENTS, raw),
    },
  })
}

function dbUrl(env: ManagedOperatorRuntimeEnv): string {
  const url = env.DATABASE_URL_DIRECT?.trim() || env.DATABASE_URL?.trim()
  if (!url) throw new Error("Managed operator runtime requires DATABASE_URL.")
  return url
}

function resolveDb(env: unknown): VoyantDb {
  const bindings = env as ManagedOperatorRuntimeEnv
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

function dbFromEnvForApp(env: ManagedOperatorRuntimeEnv): VoyantDb {
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

function createStorageProvider(bucket: R2BucketLike | undefined, publicBaseUrl?: string) {
  if (!bucket) return null
  return createR2Provider({
    bucket,
    ...(publicBaseUrl ? { publicBaseUrl } : {}),
  })
}

function createDocumentStorage(bindings: unknown) {
  return createStorageProvider((bindings as ManagedOperatorRuntimeEnv).DOCUMENTS_BUCKET)
}

async function readDocumentContentBase64(
  bindings: unknown,
  storageKey: string,
): Promise<string | null> {
  const object = await (bindings as ManagedOperatorRuntimeEnv).DOCUMENTS_BUCKET?.get(storageKey)
  if (!object) return null
  return arrayBufferToBase64(await object.arrayBuffer())
}

async function resolveDocumentDownloadUrl(
  bindings: unknown,
  storageKey: string,
): Promise<string | null> {
  const env = bindings as ManagedOperatorRuntimeEnv
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
  const env = bindings as ManagedOperatorRuntimeEnv
  return (
    env.PUBLIC_CHECKOUT_BASE_URL?.trim() ||
    env.DASH_BASE_URL?.trim() ||
    env.APP_URL?.trim().replace(/\/api\/?$/, "") ||
    null
  )
}

function resolveBankTransferDetails(bindings: unknown) {
  const env = bindings as ManagedOperatorRuntimeEnv
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
  const env = bindings as ManagedOperatorRuntimeEnv
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
  const env = bindings as ManagedOperatorRuntimeEnv
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

function createManagedOperatorWorkflowDriver(env: ManagedOperatorRuntimeEnv) {
  if (env.VOYANT_CLOUD_WORKFLOWS_URL?.trim() && env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN?.trim()) {
    return () =>
      createCloudWorkflowDriver({
        env: {
          VOYANT_CLOUD_WORKFLOWS_URL: env.VOYANT_CLOUD_WORKFLOWS_URL,
          VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN,
          VOYANT_CLOUD_APP_SLUG: env.VOYANT_CLOUD_APP_SLUG ?? "operator",
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
