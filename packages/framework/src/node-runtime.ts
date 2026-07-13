// agent-quality: file-size exception -- this entry is the resident Node runtime
// composition boundary for graph boot, environment bindings, and generic Node
// infrastructure.

import type { ActionLedgerCapabilityRegistry } from "@voyant-travel/action-ledger/capability"
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
import type { EventEnvelope, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  createPostgresFixedWindowRateLimitStore,
  createPostgresKvStore,
  resolveNodeDatabase,
} from "@voyant-travel/db/runtime"
import { authUser, cloudAuthUserLinks, userProfilesTable } from "@voyant-travel/db/schema/iam"
import {
  createMemoryRateLimitStore,
  createRedisRateLimitStore,
  type RateLimitStore,
  type VoyantAuthIntegration,
  type VoyantBindings,
  type VoyantDb,
} from "@voyant-travel/hono"
import type { ExtensionFactory, ModuleFactory } from "@voyant-travel/hono/composition"
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
} from "@voyant-travel/runtime-core"
import {
  createDocumentStorage,
  readDocumentContentBase64,
  resolveDocumentDownloadUrl,
} from "@voyant-travel/storage/runtime"
import { scopesForRole } from "@voyant-travel/types/member-roles"
import type { KVStore } from "@voyant-travel/utils/cache"
import { createRedisKvStore } from "@voyant-travel/utils/redis-kv"
import { createTieredKvStore } from "@voyant-travel/utils/tiered-kv"
import { createCloudWorkflowDriver } from "@voyant-travel/workflows/client"
import type { DriverFactory } from "@voyant-travel/workflows/driver"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator/in-memory"
import {
  createPostgresConnection,
  createStandaloneDriver,
  type PostgresConnection,
} from "@voyant-travel/workflows-orchestrator/selfhost"
import { eq, sql } from "drizzle-orm"
import { type Context, Hono } from "hono"

import { type CreateVoyantAppConfig, createVoyantApp } from "./create-app.js"
import type { VoyantGraphDeploymentRequirements } from "./deployment-graph.js"
import type {
  VoyantDeploymentEnvRequirement,
  VoyantDeploymentMode,
  VoyantDeploymentProviders,
} from "./deployment-types.js"
import { lowerVoyantGraphActionsToActionLedgerRegistry } from "./graph-action-ledger.js"
import { composeVoyantGraphRuntime } from "./runtime-composition.js"
import type { VoyantGraphRuntime } from "./runtime-lowering.js"
import {
  type ResolvedVoyantGraphRuntimeValues,
  resolveVoyantGraphRuntimeValues,
} from "./runtime-values.js"

export interface VoyantNodeRuntimeEnv extends VoyantBindings {
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
  RATE_LIMIT_STORE?: RateLimitStore
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
  ORIGIN_TRUST_SECRET?: string
  PORT?: string
}

export interface CreateVoyantNodeRuntimeHostPrimitivesOptions {
  env: VoyantNodeRuntimeEnv
  config?: Readonly<Record<string, unknown>>
  deliverEvent?: (event: unknown, bindings: unknown) => Promise<unknown>
}

export class VoyantNodeHostRequirementError extends Error {
  readonly code = "VOYANT_NODE_HOST_REQUIREMENT_MISSING"

  constructor(readonly requirement: string) {
    super(
      `Voyant Node host requirement "${requirement}" is not configured. Provide it through createVoyantNodeRuntimeHostPrimitives().`,
    )
    this.name = "VoyantNodeHostRequirementError"
  }
}

/** Domain-neutral infrastructure supplied to statically selected runtime contributors. */
export function createVoyantNodeRuntimeHostPrimitives(
  options: CreateVoyantNodeRuntimeHostPrimitivesOptions,
): VoyantRuntimeHostPrimitives {
  const fallbackEnv = options.env
  const bindingsEnv = (bindings: unknown): VoyantNodeRuntimeEnv =>
    bindings && typeof bindings === "object" ? (bindings as VoyantNodeRuntimeEnv) : fallbackEnv

  return {
    env: (bindings) => ({ ...bindingsEnv(bindings) }),
    database: {
      resolve: <TDatabase>(bindings: unknown) =>
        asRuntimeDatabase<TDatabase>(resolveDb(bindingsEnv(bindings))),
      fromContext: <TDatabase>(context: unknown) => {
        const candidate = context as {
          env?: VoyantNodeRuntimeEnv
          get?: (key: string) => unknown
        }
        const requestDb = candidate?.get?.("db")
        return (requestDb ?? resolveDb(candidate?.env ?? fallbackEnv)) as TDatabase
      },
      transaction: async (bindings, operation) => {
        const database = resolveDb(bindingsEnv(bindings)) as VoyantDb & {
          transaction<T>(operation: (database: unknown) => Promise<T>): Promise<T>
        }
        return database.transaction(operation)
      },
    },
    storage: {
      resolve: (bindings) => createDocumentStorage(bindingsEnv(bindings)),
      read: (bindings, key) => readDocumentContentBase64(bindingsEnv(bindings), key),
      downloadUrl: (bindings, key) => resolveDocumentDownloadUrl(bindingsEnv(bindings), key),
    },
    events: {
      deliver: (event, bindings) => {
        if (!options.deliverEvent) {
          throw new VoyantNodeHostRequirementError("events.deliver")
        }
        return options.deliverEvent(event, bindings)
      },
    },
    config: {
      read: (bindings, key) =>
        Object.hasOwn(options.config ?? {}, key)
          ? options.config?.[key]
          : Reflect.get(bindingsEnv(bindings), key),
    },
  }
}

function asRuntimeDatabase<TDatabase>(database: VoyantDb): TDatabase {
  return database as TDatabase
}

/** Generic host resources available only to deployment-local factories. */
export type VoyantNodeRuntimeResources = Readonly<Record<string, unknown>>

/** Graph-native deployment settings consumed by the resident Node host. */
export interface VoyantNodeRuntimeDeployment {
  mode: VoyantDeploymentMode
  providers: Readonly<Record<string, string>> & Pick<VoyantDeploymentProviders, "workflows">
}

/** Inputs for booting a generated application graph in a resident Node process. */
export interface VoyantNodeRuntimeOptions {
  graphRuntime: VoyantGraphRuntime
  deployment: VoyantNodeRuntimeDeployment
  deploymentRequirements: VoyantGraphDeploymentRequirements
  runtimePorts?: import("./runtime-composition.js").VoyantGraphRuntimePorts
  /** Node-owned durable boundary for graph-selected outbound webhook events. */
  outboundWebhooks?: {
    enqueue: (event: EventEnvelope, bindings: unknown) => Promise<unknown>
  }
  /** Generic resources available to deployment-local factories. */
  resources?: VoyantNodeRuntimeResources
  applicationId?: string
  env?: Record<string, unknown> | VoyantNodeRuntimeEnv
  auth?: VoyantAuthIntegration<VoyantNodeRuntimeEnv>
  /** @deprecated Use `resources`; package behavior belongs behind `runtimePorts`. */
  providers?: VoyantNodeRuntimeResources
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<VoyantNodeRuntimeEnv, VoyantNodeRuntimeResources>,
      "providers" | "workflows"
    >
  >
}

/** A graph-native application runtime hosted by Node. */
export interface VoyantNodeRuntime {
  graphRuntime: VoyantGraphRuntime
  deployment: VoyantNodeRuntimeDeployment
  requirements: VoyantGraphDeploymentRequirements
  env: VoyantNodeRuntimeEnv
  graphValues: ResolvedVoyantGraphRuntimeValues
  app: ReturnType<typeof createVoyantNodeApp>
  actionLedgerCapabilities: ActionLedgerCapabilityRegistry
  fetch: (
    request: Request,
    env?: VoyantNodeRuntimeEnv,
    ctx?: ExecutionContextLike,
  ) => Response | Promise<Response>
  start: (options?: Partial<CreateNodeServerOptions<VoyantNodeRuntimeEnv>>) => NodeServerHandle
}

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

interface NodeSharedStores {
  CACHE: KVStore
  RATE_LIMIT: KVStore
  RATE_LIMIT_STORE: RateLimitStore
}

/** Boot a generated application graph without constructing a profile compatibility manifest. */
export async function loadVoyantNodeRuntime(
  options: VoyantNodeRuntimeOptions,
): Promise<VoyantNodeRuntime> {
  const env = createVoyantNodeEnv(options.env ?? process.env)
  assertVoyantNodeWorkflowProviderConfigured(options.deployment, env)
  const requirements = options.deploymentRequirements
  const graphValues = await resolveVoyantGraphRuntimeValues(options.graphRuntime, {
    deploymentValues: toPluginEnvRecord(env),
    deploymentValueAliases: deploymentValueAliases(requirements),
  })
  const activeModules = options.graphRuntime.modules.map((unit) => unit.localId ?? unit.id)
  const auth = resolveVoyantNodeAuthIntegration({
    env,
    auth: options.app?.auth ?? options.auth,
    activeModules,
  })
  const resources = { ...(options.providers ?? {}), ...(options.resources ?? {}) }
  const graphComposition = await composeVoyantGraphRuntime({
    runtime: options.graphRuntime,
    capabilities: resources,
    ports: options.runtimePorts,
    outboundWebhooks: options.outboundWebhooks,
  })
  const actionLedgerCapabilities = lowerVoyantGraphActionsToActionLedgerRegistry(
    options.graphRuntime,
  )
  assertVoyantNodeRuntimeSupport({
    mode: options.deployment.mode,
    requirements,
    env,
    hasAuthIntegration: Boolean(auth),
  })
  const applicationId = options.applicationId?.trim() || "application"
  const app = createVoyantNodeApp({
    applicationId,
    activeModules,
    deployment: options.deployment,
    env,
    auth,
    resources,
    app: {
      ...options.app,
      accessCatalog: options.app?.accessCatalog ?? options.graphRuntime.accessCatalog,
      publicPaths: [
        ...(options.app?.publicPaths ?? []),
        ...graphComposition.routePosture.publicPaths,
      ],
      dbTransactionalPaths: [
        ...(options.app?.dbTransactionalPaths ?? []),
        ...graphComposition.routePosture.transactionalPaths,
      ],
      accessResources: [
        ...(options.app?.accessResources ?? []),
        ...graphComposition.accessResources,
      ],
    },
    modules: Object.fromEntries(
      graphComposition.modules.map((module, index) => [
        `selected-graph-module:${index}:${module.module.name}`,
        () => module,
      ]),
    ),
    extensions: Object.fromEntries(
      graphComposition.extensions.map((extension, index) => [
        `selected-graph-extension:${index}:${extension.extension.name}`,
        () => extension,
      ]),
    ),
  })

  return {
    graphRuntime: options.graphRuntime,
    deployment: options.deployment,
    requirements,
    env,
    graphValues,
    app,
    actionLedgerCapabilities,
    fetch: (request, bindings = env, ctx = createNoopExecutionContext()) =>
      app.fetch(request, bindings, toHonoExecutionContext(ctx)),
    start: (serverOptions = {}) =>
      createNodeServer<VoyantNodeRuntimeEnv>({
        fetch: (request, bindings, ctx) =>
          app.fetch(request, bindings, toHonoExecutionContext(ctx)),
        env,
        port: Number.parseInt(env.PORT ?? "8080", 10),
        ...(env.ORIGIN_TRUST_SECRET ? { originTrustSecret: env.ORIGIN_TRUST_SECRET } : {}),
        ...serverOptions,
      }),
  }
}

export async function startVoyantNodeRuntime(
  options: VoyantNodeRuntimeOptions & {
    server?: Partial<CreateNodeServerOptions<VoyantNodeRuntimeEnv>>
  },
): Promise<NodeServerHandle> {
  const runtime = await loadVoyantNodeRuntime(options)
  return runtime.start(options.server)
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

export function createVoyantNodeApp(options: {
  applicationId: string
  activeModules: readonly string[]
  deployment: VoyantNodeRuntimeDeployment
  env?: VoyantNodeRuntimeEnv
  auth?: VoyantAuthIntegration<VoyantNodeRuntimeEnv>
  resources?: VoyantNodeRuntimeResources
  /** @deprecated Use `resources`; package behavior belongs behind graph runtime ports. */
  providers?: VoyantNodeRuntimeResources
  app?: Partial<
    Omit<
      CreateVoyantAppConfig<VoyantNodeRuntimeEnv, VoyantNodeRuntimeResources>,
      "providers" | "workflows"
    >
  >
  modules?: Record<string, ModuleFactory<VoyantNodeRuntimeResources>>
  extensions?: Record<string, ExtensionFactory<VoyantNodeRuntimeResources>>
}) {
  const auth = resolveVoyantNodeAuthIntegration({
    env: options.env,
    auth: options.app?.auth ?? options.auth,
    activeModules: options.activeModules,
  })
  const workflows = createVoyantNodeWorkflowConfig({
    deployment: options.deployment,
    env: options.env ?? createVoyantNodeEnv(process.env),
    defaultAppSlug: options.applicationId,
  })
  return createVoyantApp<VoyantNodeRuntimeEnv, VoyantNodeRuntimeResources>({
    db: resolveDb,
    dbTransactional: resolveDb,
    outbox: true,
    ...options.app,
    workflows,
    modules: {
      ...(options.app?.modules ?? {}),
      ...(options.modules ?? {}),
    },
    extensions: {
      ...(options.app?.extensions ?? {}),
      ...(options.extensions ?? {}),
    },
    basePath: options.app?.basePath ?? "/api",
    auth,
    providers: { ...(options.providers ?? {}), ...(options.resources ?? {}) },
  })
}

export function createVoyantNodeEnv(
  processEnv: Record<string, unknown> | VoyantNodeRuntimeEnv,
): VoyantNodeRuntimeEnv {
  const raw: Record<string, unknown> = Object.fromEntries(Object.entries(processEnv))
  const stringEnv = Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
  const stores = createNodeSharedStores(raw, stringEnv)
  return composeNodeEnv<VoyantNodeRuntimeEnv>(stringEnv, {
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

function resolveVoyantNodeAuthIntegration(options: {
  env?: VoyantNodeRuntimeEnv
  auth?: VoyantAuthIntegration<VoyantNodeRuntimeEnv>
  /** Active module ids surfaced on `/auth/bootstrap-status` for admin gating (voyant#3063). */
  activeModules?: readonly string[]
}): VoyantAuthIntegration<VoyantNodeRuntimeEnv> | undefined {
  if (options.auth) return options.auth
  if (!isManagedVoyantCloudAuthMode(options.env)) return undefined
  return createManagedCloudAdminAuthIntegration(options.activeModules ?? [])
}

function createManagedCloudAdminAuthIntegration(
  activeModules: readonly string[],
): VoyantAuthIntegration<VoyantNodeRuntimeEnv> {
  return {
    handler: () => {
      const app = createVoyantCloudAuthApp(activeModules)
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

type NodeAuthHonoEnv = { Bindings: VoyantNodeRuntimeEnv }

export function createVoyantCloudAuthApp(
  activeModules: readonly string[] = [],
): Hono<NodeAuthHonoEnv> {
  const auth = new Hono<NodeAuthHonoEnv>()

  async function startCloudAuth(c: Context<NodeAuthHonoEnv>) {
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
 * Shape returned by `GET /auth/me` for a source-free hosted admin —
 * mirrors the operator starter's `CurrentUser` so the packaged admin UI can
 * resolve its current user directly from the managed API.
 */
export type VoyantNodeCurrentUser = {
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

export type VoyantNodeBootstrapStatus = {
  hasUsers: boolean
  authMode: "local" | "voyant-cloud"
  /**
   * The active module ids for this deployment (voyant#3063). The source-free
   * hosted admin — a shared, framework-version-tagged image — reads this to
   * gate its composition to the modules admitted by the deployment graph,
   * instead of every module the image can compose.
   */
  modules: string[]
}

async function resolveManagedCurrentUser(
  env: VoyantNodeRuntimeEnv,
  request: Request,
): Promise<VoyantNodeCurrentUser | null> {
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
    uiPrefs: (row.uiPrefs as VoyantNodeCurrentUser["uiPrefs"]) ?? null,
    isSuperAdmin: row.isSuperAdmin ?? false,
    isSupportUser: row.isSupportUser ?? false,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    profilePictureUrl: row.avatarUrl ?? null,
  }
}

async function resolveManagedBootstrapStatus(
  env: VoyantNodeRuntimeEnv,
  _request: Request,
  activeModules: readonly string[],
): Promise<VoyantNodeBootstrapStatus> {
  const modules = [...activeModules]
  if (isManagedVoyantCloudAuthMode(env)) {
    return { hasUsers: true, authMode: "voyant-cloud", modules }
  }

  const db = resolveDb(env)
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
  return { hasUsers: (row?.count ?? 0) > 0, authMode: "local", modules }
}

function createManagedBetterAuth(env: VoyantNodeRuntimeEnv, db: VoyantDb) {
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
  env: VoyantNodeRuntimeEnv | undefined,
): "local" | "voyant-cloud" {
  const mode = env?.VOYANT_ADMIN_AUTH_MODE?.trim() || "local"
  if (mode === "local" || mode === "voyant-cloud") return mode

  console.error(
    `[managed-auth] Invalid VOYANT_ADMIN_AUTH_MODE="${mode}". Failing closed as voyant-cloud.`,
  )
  return "voyant-cloud"
}

function isManagedVoyantCloudAuthMode(env: VoyantNodeRuntimeEnv | undefined): boolean {
  return resolveManagedAdminAuthMode(env) === "voyant-cloud"
}

function getManagedCloudAuthStartConfig(env: VoyantNodeRuntimeEnv) {
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

function getManagedCloudAuthExchangeConfig(env: VoyantNodeRuntimeEnv) {
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

function getManagedCloudAuthRevalidateConfig(env: VoyantNodeRuntimeEnv) {
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

function getManagedAuthBaseUrl(env: VoyantNodeRuntimeEnv): string {
  const appUrl = getManagedAppUrl(env)
  try {
    const parsed = new URL(appUrl)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return appUrl
  }
}

function getManagedPublicApiBaseUrl(env: VoyantNodeRuntimeEnv): string {
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

function getManagedTrustedOrigins(env: VoyantNodeRuntimeEnv): string[] {
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

function getManagedAppUrl(env: VoyantNodeRuntimeEnv): string {
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

function createNodeSharedStores(
  raw: Record<string, unknown>,
  env: Record<string, string>,
): NodeSharedStores {
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
    const runtimeEnv: VoyantNodeRuntimeEnv = {
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

function assertVoyantNodeRuntimeSupport(options: {
  mode: VoyantDeploymentMode
  requirements: VoyantGraphDeploymentRequirements
  env: VoyantNodeRuntimeEnv
  hasAuthIntegration: boolean
}) {
  const issues = nodeRuntimeEnvIssues(options.requirements, options.env)
  if (options.mode === "managed-cloud" && !options.hasAuthIntegration) {
    issues.push(
      "managed-cloud applications require VOYANT_ADMIN_AUTH_MODE=voyant-cloud with Cloud admin auth env, or an injected admin auth integration",
    )
  }
  if (issues.length > 0) {
    throw new Error(`Voyant Node runtime is not ready to start:\n${formatIssues(issues)}`)
  }
}

function nodeRuntimeEnvIssues(
  requirements: Pick<VoyantGraphDeploymentRequirements, "resources">,
  env: VoyantNodeRuntimeEnv,
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

function getEnvValue(env: VoyantNodeRuntimeEnv, name: string): unknown {
  return Reflect.get(env, name)
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
}

function hasFormat(
  value: unknown,
  format: NonNullable<VoyantDeploymentEnvRequirement["format"]>,
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

function formatDescription(format: NonNullable<VoyantDeploymentEnvRequirement["format"]>): string {
  if (format === "postgres-url") return "a Postgres URL"
  if (format === "redis-url") return "a Redis URL"
  return "an HTTP(S) URL"
}

function resolveDb(env: unknown): VoyantDb {
  return resolveNodeDatabase(env as VoyantNodeRuntimeEnv) as VoyantDb
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

export type VoyantNodeWorkflowProvider = VoyantDeploymentProviders["workflows"]

export interface CreateVoyantNodeWorkflowDriverOptions {
  deployment: VoyantNodeRuntimeDeployment
  env: VoyantNodeRuntimeEnv
  defaultAppSlug: string
  /** Disable resident scheduler and time-wheel loops for a one-shot cron invocation. */
  oneShot?: boolean
}

const WORKFLOW_PROVIDERS = new Set<VoyantNodeWorkflowProvider>([
  "voyant-cloud",
  "self-hosted",
  "none",
])
const selfHostedWorkflowConnections = new Map<string, PostgresConnection>()

export function resolveVoyantNodeWorkflowProvider(value: unknown): VoyantNodeWorkflowProvider {
  if (typeof value === "string" && WORKFLOW_PROVIDERS.has(value as VoyantNodeWorkflowProvider)) {
    return value as VoyantNodeWorkflowProvider
  }
  throw new Error(
    `Unsupported deployment.providers.workflows value ${JSON.stringify(value)}. Expected "voyant-cloud", "self-hosted", or "none".`,
  )
}

export function createVoyantNodeWorkflowDriver(
  options: CreateVoyantNodeWorkflowDriverOptions,
): DriverFactory | undefined {
  const provider = assertVoyantNodeWorkflowProviderConfigured(options.deployment, options.env)
  if (provider === "none") return undefined

  const environment = options.env.VOYANT_CLOUD_ENVIRONMENT ?? "development"
  if (provider === "voyant-cloud") {
    return () =>
      createCloudWorkflowDriver({
        env: {
          VOYANT_CLOUD_WORKFLOWS_URL: requireWorkflowEnv(
            options.env.VOYANT_CLOUD_WORKFLOWS_URL,
            "VOYANT_CLOUD_WORKFLOWS_URL",
          ),
          VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: requireWorkflowEnv(
            options.env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN,
            "VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN",
          ),
          VOYANT_CLOUD_APP_SLUG: options.env.VOYANT_CLOUD_APP_SLUG ?? options.defaultAppSlug,
          VOYANT_CLOUD_ENVIRONMENT: environment,
        },
      })
  }

  if (options.deployment.mode === "local") {
    return createInMemoryDriver({
      defaultEnvironment: environment,
      ...(options.oneShot ? { disableScheduleRunner: true } : {}),
    })
  }
  if (options.deployment.mode !== "self-hosted") {
    throw new Error(
      `deployment.providers.workflows="self-hosted" is not supported in ${options.deployment.mode} mode.`,
    )
  }

  const databaseUrl = resolveWorkflowDatabaseUrl(options.env)
  let connection = selfHostedWorkflowConnections.get(databaseUrl)
  if (!connection) {
    connection = createPostgresConnection({ databaseUrl })
    selfHostedWorkflowConnections.set(databaseUrl, connection)
  }
  return createStandaloneDriver({
    db: connection.db,
    defaultEnvironment: environment,
    ...(options.oneShot ? { disableScheduleRunner: true, disableTimeWheel: true } : {}),
  })
}

function createVoyantNodeWorkflowConfig(options: CreateVoyantNodeWorkflowDriverOptions) {
  const provider = assertVoyantNodeWorkflowProviderConfigured(options.deployment, options.env)
  if (provider === "none") return undefined
  return {
    driver: (bindings: unknown) =>
      createVoyantNodeWorkflowDriver({
        ...options,
        env: bindings as VoyantNodeRuntimeEnv,
      })!,
    environment: options.env.VOYANT_CLOUD_ENVIRONMENT ?? "development",
    projectId: options.env.VOYANT_CLOUD_APP_SLUG ?? options.defaultAppSlug,
  }
}

function assertVoyantNodeWorkflowProviderConfigured(
  deployment: VoyantNodeRuntimeDeployment,
  env: VoyantNodeRuntimeEnv,
): VoyantNodeWorkflowProvider {
  const provider = resolveVoyantNodeWorkflowProvider(deployment.providers.workflows)
  if (provider === "voyant-cloud") {
    requireWorkflowEnv(env.VOYANT_CLOUD_WORKFLOWS_URL, "VOYANT_CLOUD_WORKFLOWS_URL")
    requireWorkflowEnv(
      env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN,
      "VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN",
    )
  } else if (provider === "self-hosted" && deployment.mode === "self-hosted") {
    resolveWorkflowDatabaseUrl(env)
  } else if (provider === "self-hosted" && deployment.mode === "managed-cloud") {
    throw new Error(
      'deployment.providers.workflows="self-hosted" is not supported in managed-cloud mode.',
    )
  }
  return provider
}

function resolveWorkflowDatabaseUrl(env: VoyantNodeRuntimeEnv): string {
  const databaseUrl = env.DATABASE_URL_DIRECT?.trim() || env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error(
      'deployment.providers.workflows="self-hosted" requires DATABASE_URL or DATABASE_URL_DIRECT.',
    )
  }
  return databaseUrl
}

function requireWorkflowEnv(value: string | undefined, name: string): string {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`deployment.providers.workflows="voyant-cloud" requires ${name}.`)
  }
  return normalized
}

/**
 * Flatten the runtime env bag (string vars + provider bindings) into a plain
 * record for plugin factories to read secrets/connection config from. A real
 * mapper rather than a cast — the managed env has no index signature.
 */
function toPluginEnvRecord(env: VoyantNodeRuntimeEnv): Record<string, unknown> {
  return Object.fromEntries(Object.entries(env))
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
