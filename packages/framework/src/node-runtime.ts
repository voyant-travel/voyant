// agent-quality: file-size exception -- this entry is the resident Node runtime
// composition boundary. Graph boot, legacy profile adaptation, environment
// binding assembly, and generic Node infrastructure stay together while
// compatibility is retired incrementally.
import { readFile } from "node:fs/promises"

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
  createDbClient,
  createPostgresFixedWindowRateLimitStore,
  createPostgresKvStore,
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
} from "@voyant-travel/runtime"
import { scopesForRole } from "@voyant-travel/types/member-roles"
import type { KVStore } from "@voyant-travel/utils/cache"
import { createRedisKvStore } from "@voyant-travel/utils/redis-kv"
import { createTieredKvStore } from "@voyant-travel/utils/tiered-kv"
import { createCloudWorkflowDriver } from "@voyant-travel/workflows/client"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator/in-memory"
import { eq, sql } from "drizzle-orm"
import { type Context, Hono } from "hono"

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
  type VoyantProfileEnvRequirement,
  type VoyantProfileRequirements,
  type VoyantProjectDeploymentMode,
  type VoyantProjectManifest,
  type VoyantProjectProviders,
  validateVoyantProject,
} from "./profile.js"
import { composeVoyantGraphRuntime } from "./runtime-composition.js"
import type { VoyantGraphRuntime } from "./runtime-lowering.js"
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

export type VoyantNodeRuntimeEnv = ManagedProfileRuntimeEnv

/** Generic host resources available only to deployment-local factories. */
export type VoyantNodeRuntimeResources = Readonly<Record<string, unknown>>

type ManagedProfileAppModules = Record<string, ModuleFactory<VoyantNodeRuntimeResources>>
type ManagedProfileAppExtensions = Record<string, ExtensionFactory<VoyantNodeRuntimeResources>>

export interface ManagedProfileRuntimeOptions {
  /** Existing compatibility input for callers that persist a profile snapshot. */
  profileSnapshotPath?: string
  /** Admitted in-memory project manifest for graph-native Node hosts. */
  project?: VoyantProjectManifest
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
  /** Generic resources available to deployment-local factories. */
  resources?: VoyantNodeRuntimeResources
  env?: Record<string, unknown> | VoyantNodeRuntimeEnv
  auth?: VoyantAuthIntegration<VoyantNodeRuntimeEnv>
  /** @deprecated Use `resources`; package behavior belongs behind `runtimePorts`. */
  providers?: VoyantNodeRuntimeResources
  app?: Partial<
    Omit<CreateVoyantAppConfig<VoyantNodeRuntimeEnv, VoyantNodeRuntimeResources>, "providers">
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
  env: VoyantNodeRuntimeEnv
  graphValues?: ResolvedVoyantGraphRuntimeValues
  app: ReturnType<typeof createManagedProfileApp>
  actionLedgerCapabilities: ActionLedgerCapabilityRegistry
  fetch: (
    request: Request,
    env?: VoyantNodeRuntimeEnv,
    ctx?: ExecutionContextLike,
  ) => Response | Promise<Response>
  start: (options?: Partial<CreateNodeServerOptions<VoyantNodeRuntimeEnv>>) => NodeServerHandle
}

/** Graph-native deployment settings consumed by the resident Node host. */
export interface VoyantNodeRuntimeDeployment {
  mode: VoyantProjectDeploymentMode
  providers: Readonly<Record<string, string>>
}

/** Inputs for booting a generated application graph in a resident Node process. */
export interface VoyantNodeRuntimeOptions {
  graphRuntime: VoyantGraphRuntime
  deployment: VoyantNodeRuntimeDeployment
  deploymentRequirements: VoyantGraphDeploymentRequirements
  runtimePorts?: import("./runtime-composition.js").VoyantGraphRuntimePorts
  /** Generic resources available to deployment-local factories. */
  resources?: VoyantNodeRuntimeResources
  applicationId?: string
  env?: Record<string, unknown> | ManagedProfileRuntimeEnv
  auth?: VoyantAuthIntegration<ManagedProfileRuntimeEnv>
  /** @deprecated Use `resources`; package behavior belongs behind `runtimePorts`. */
  providers?: VoyantNodeRuntimeResources
  app?: Partial<
    Omit<CreateVoyantAppConfig<ManagedProfileRuntimeEnv, VoyantNodeRuntimeResources>, "providers">
  >
}

/** A graph-native application runtime hosted by Node. */
export interface VoyantNodeRuntime {
  graphRuntime: VoyantGraphRuntime
  deployment: VoyantNodeRuntimeDeployment
  requirements: VoyantGraphDeploymentRequirements
  env: ManagedProfileRuntimeEnv
  graphValues: ResolvedVoyantGraphRuntimeValues
  app: ReturnType<typeof createVoyantNodeApp>
  actionLedgerCapabilities: ActionLedgerCapabilityRegistry
  fetch: (
    request: Request,
    env?: ManagedProfileRuntimeEnv,
    ctx?: ExecutionContextLike,
  ) => Response | Promise<Response>
  start: (options?: Partial<CreateNodeServerOptions<ManagedProfileRuntimeEnv>>) => NodeServerHandle
}

let pooledDb: { url: string; db: VoyantDb } | undefined
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
  RATE_LIMIT_STORE: RateLimitStore
}

/** Boot a generated application graph without constructing a profile compatibility manifest. */
export async function loadVoyantNodeRuntime(
  options: VoyantNodeRuntimeOptions,
): Promise<VoyantNodeRuntime> {
  const env = createManagedProfileNodeEnv(options.env ?? process.env)
  const requirements = options.deploymentRequirements
  const graphValues = await resolveVoyantGraphRuntimeValues(options.graphRuntime, {
    deploymentValues: toPluginEnvRecord(env),
    deploymentValueAliases: deploymentValueAliases(requirements),
  })
  const activeModules = options.graphRuntime.modules.map((unit) => unit.localId ?? unit.id)
  const auth = resolveManagedProfileAuthIntegration({
    env,
    auth: options.app?.auth ?? options.auth,
    activeModules,
  })
  const resources = { ...(options.providers ?? {}), ...(options.resources ?? {}) }
  const graphComposition = await composeVoyantGraphRuntime({
    runtime: options.graphRuntime,
    capabilities: resources,
    ports: options.runtimePorts,
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
    env,
    auth,
    resources,
    app: {
      ...options.app,
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

export async function loadManagedProfileRuntime(
  options: ManagedProfileRuntimeOptions,
): Promise<ManagedProfileRuntime> {
  const project = applyManagedRuntimeDeployment(
    await resolveManagedRuntimeProject(options),
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
  const customModules = await resolveManagedCustomModules<VoyantNodeRuntimeResources>(
    project,
    toPluginEnvRecord(env),
    customSourceOptions,
  )
  const resources = { ...(options.providers ?? {}), ...(options.resources ?? {}) }
  const graphComposition = options.graphRuntime
    ? await composeVoyantGraphRuntime({
        runtime: options.graphRuntime,
        capabilities: resources,
        ports: options.runtimePorts,
      })
    : undefined
  const actionLedgerCapabilities = options.graphRuntime
    ? lowerVoyantGraphActionsToActionLedgerRegistry(options.graphRuntime)
    : createActionLedgerCapabilityRegistry([])
  const customExtensions = await resolveManagedCustomExtensions<VoyantNodeRuntimeResources>(
    project,
    toPluginEnvRecord(env),
    customSourceOptions,
  )
  for (const [index, module] of (graphComposition?.modules ?? []).entries()) {
    customModules[`selected-graph-module:${index}:${module.module.name}`] = () => module
  }
  for (const [index, extension] of (graphComposition?.extensions ?? []).entries()) {
    customExtensions[`selected-graph-extension:${index}:${extension.extension.name}`] = () =>
      extension
  }
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
    resources,
    app: graphComposition
      ? {
          ...options.app,
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
        }
      : options.app,
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

async function resolveManagedRuntimeProject(
  options: Pick<ManagedProfileRuntimeOptions, "profileSnapshotPath" | "project">,
): Promise<VoyantProjectManifest> {
  if (options.project) {
    const validation = validateVoyantProject(options.project)
    if (!validation.ok) {
      throw new Error(
        `Invalid managed runtime project:\n${validation.issues
          .map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`)
          .join("\n")}`,
      )
    }
    return options.project
  }
  if (options.profileSnapshotPath) return loadManagedProfileSnapshot(options.profileSnapshotPath)
  throw new Error("Managed runtime requires an admitted project manifest or profile snapshot path.")
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

export function createVoyantNodeApp(options: {
  applicationId: string
  activeModules: readonly string[]
  env?: VoyantNodeRuntimeEnv
  auth?: VoyantAuthIntegration<VoyantNodeRuntimeEnv>
  resources?: VoyantNodeRuntimeResources
  /** @deprecated Use `resources`; package behavior belongs behind graph runtime ports. */
  providers?: VoyantNodeRuntimeResources
  app?: Partial<
    Omit<CreateVoyantAppConfig<VoyantNodeRuntimeEnv, VoyantNodeRuntimeResources>, "providers">
  >
  modules?: ManagedProfileAppModules
  extensions?: ManagedProfileAppExtensions
}) {
  const auth = resolveManagedProfileAuthIntegration({
    env: options.env,
    auth: options.app?.auth ?? options.auth,
    activeModules: options.activeModules,
  })
  return createVoyantApp<VoyantNodeRuntimeEnv, VoyantNodeRuntimeResources>({
    db: dbFromEnvForApp,
    dbTransactional: dbFromEnvForApp,
    outbox: true,
    workflows: {
      driver: (bindings) =>
        createManagedProfileWorkflowDriver(bindings as VoyantNodeRuntimeEnv, options.applicationId),
      environment: options.env?.VOYANT_CLOUD_ENVIRONMENT ?? "development",
      projectId: options.env?.VOYANT_CLOUD_APP_SLUG ?? options.applicationId,
    },
    ...options.app,
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
  resources?: VoyantNodeRuntimeResources
  /** @deprecated Use `resources`; package behavior belongs behind graph runtime ports. */
  providers?: VoyantNodeRuntimeResources
  graphRuntime?: VoyantGraphRuntime
  app?: Partial<
    Omit<CreateVoyantAppConfig<ManagedProfileRuntimeEnv, VoyantNodeRuntimeResources>, "providers">
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
  return createVoyantApp<ManagedProfileRuntimeEnv, VoyantNodeRuntimeResources>({
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
      VoyantNodeRuntimeResources
    >["plugins"],
    modules: mergedModules,
    extensions: mergedExtensions,
    basePath: options.app?.basePath ?? "/api",
    auth,
    providers: { ...(options.providers ?? {}), ...(options.resources ?? {}) },
  })
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

function assertVoyantNodeRuntimeSupport(options: {
  mode: VoyantProjectDeploymentMode
  requirements: VoyantGraphDeploymentRequirements
  env: ManagedProfileRuntimeEnv
  hasAuthIntegration: boolean
}) {
  const issues = managedProfileEnvIssues(options.requirements, options.env)
  if (options.mode === "managed-cloud" && !options.hasAuthIntegration) {
    issues.push(
      "managed-cloud applications require VOYANT_ADMIN_AUTH_MODE=voyant-cloud with Cloud admin auth env, or an injected admin auth integration",
    )
  }
  if (issues.length > 0) {
    throw new Error(`Voyant Node runtime is not ready to start:\n${formatIssues(issues)}`)
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
  requirements: Pick<VoyantProfileRequirements, "resources">,
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

/**
 * Flatten the runtime env bag (string vars + provider bindings) into a plain
 * record for plugin factories to read secrets/connection config from. A real
 * mapper rather than a cast — the managed env has no index signature.
 */
function toPluginEnvRecord(env: ManagedProfileRuntimeEnv): Record<string, unknown> {
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
