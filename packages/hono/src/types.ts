import type {
  Actor,
  VoyantVariables as CoreVoyantVariables,
  EventBus,
  LinkService,
  ModuleContainer,
  QueryGraphContext,
  QueryRunner,
  VoyantAuthContext,
  VoyantPermission,
} from "@voyant-travel/core"
import type { SelectApikey } from "@voyant-travel/db/schema/iam"
import { dbClientDispose } from "@voyant-travel/db/transaction-capability"
import type { KVStore } from "@voyant-travel/utils/cache"
import type { DriverFactory } from "@voyant-travel/workflows/driver"
import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import type { NeonDatabase as NeonWsDatabase } from "drizzle-orm/neon-serverless"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Hono } from "hono"

import type { HonoExtension, HonoModule } from "./module.js"
import type { Reporter } from "./observability/reporter.js"
import type { HonoBundleInput } from "./plugin.js"

export interface VoyantExecutionContext {
  waitUntil?: (promise: Promise<unknown>) => void
  passThroughOnException?: () => void
}

export interface VoyantBindings {
  INTERNAL_API_KEY?: string
  INTERNAL_API_KEY_SCOPES?: string
  SESSION_CLAIMS_SECRET?: string
  BETTER_AUTH_SECRET?: string
  DATABASE_URL: string
  CORS_ALLOWLIST?: string
  APP_URL?: string
  DASH_BASE_URL?: string
  API_BASE_URL?: string
  RATE_LIMIT?: KVStore
  CACHE?: KVStore
  RATE_LIMITER?: import("./middleware/rate-limit.js").CloudflareRateLimiterBinding
  /**
   * Workers Analytics Engine dataset receiving per-request metrics
   * (see the `metrics` middleware). Optional — without it the
   * middleware is a no-op.
   */
  METRICS?: import("./middleware/metrics.js").AnalyticsEngineDatasetLike
}

export type VoyantDb = PostgresJsDatabase | NeonHttpDatabase | NeonWsDatabase
export type VoyantQueryRuntime = QueryRunner

export type VoyantVariables = CoreVoyantVariables & {
  /**
   * Per-request correlation id (RFC #1553). Set by the `requestId` middleware;
   * also on the `X-Request-Id` response header and readable from any async
   * context via `getRequestId()`.
   */
  requestId?: string
  db: VoyantDb
  /** Shared app/runtime container for explicit service resolution. */
  container: ModuleContainer
  eventBus: EventBus
  /** Shared cross-module link runtime, when the app wires one in. */
  link?: LinkService
  /** Shared cross-module query runtime, when the app wires one in. */
  query?: VoyantQueryRuntime
  /** Optional workflow driver surfaced to HTTP routes after lazy app bootstrap. */
  workflowDriver?: import("@voyant-travel/workflows/driver").WorkflowDriver
  /** Per-request db metrics counter populated by the metrics middleware. */
  __voyantDbMetrics?: import("./middleware/metrics.js").RequestDbMetrics
}

/**
 * Per-request handle returned by a {@link DbFactory} that owns its own
 * Pool / connection: a drizzle client plus a `dispose()` the db
 * middleware schedules via `c.executionCtx.waitUntil` after the
 * response is sent. Used by templates that build a Neon WebSocket
 * Pool per request (see e.g. `dbFromEnvForApp` in template
 * `src/api/lib/db.ts`) — without `dispose()`, the Pool stays open
 * until the Workers isolate is reclaimed.
 */
export interface DisposableDb {
  db: VoyantDb
  dispose: () => Promise<void>
}

export type DbFactory<TBindings extends VoyantBindings = VoyantBindings> = (
  env: TBindings,
) => VoyantDb | DisposableDb

/**
 * Result of routing a request path to a db factory (see
 * {@link DbFactorySelector}).
 */
export interface DbSurfaceSelection<TBindings extends VoyantBindings = VoyantBindings> {
  factory: DbFactory<TBindings>
  /**
   * Whether this surface must receive an interactive-transaction-capable
   * client. The db middleware asserts the resolved client's capability
   * tag when `true` and skips the assertion when `false` (the default
   * http-backed client is deliberately transaction-incapable).
   */
  mustSupportTransactions: boolean
}

/**
 * Routes a request path to the db factory that should serve it. Built by
 * `createApp` when the deployment supplies both a default (http-backed)
 * and a transactional (WebSocket-backed) factory: surfaces owned by
 * modules that declare `requiresTransactionalDb` get the transactional
 * factory; everything else gets the cheap default. The selector MUST
 * return stable factory references — per-request client sharing
 * (`acquireRequestDb`) keys on factory identity.
 */
export interface DbFactorySelector<TBindings extends VoyantBindings = VoyantBindings> {
  select(path: string): DbSurfaceSelection<TBindings>
}

/** Either a single factory for all requests, or a per-path selector. */
export type DbSource<TBindings extends VoyantBindings = VoyantBindings> =
  | DbFactory<TBindings>
  | DbFactorySelector<TBindings>

export function isDbFactorySelector<TBindings extends VoyantBindings>(
  source: DbSource<TBindings>,
): source is DbFactorySelector<TBindings> {
  return typeof source !== "function" && typeof source.select === "function"
}

/** Normalize a {@link DbSource} to the factory serving `path`. */
export function selectDbFactory<TBindings extends VoyantBindings>(
  source: DbSource<TBindings>,
  path: string,
): DbFactory<TBindings> {
  return isDbFactorySelector(source) ? source.select(path).factory : source
}

export function isDisposableDb(value: VoyantDb | DisposableDb): value is DisposableDb {
  return (
    typeof (value as DisposableDb).dispose === "function" &&
    (value as DisposableDb).db !== undefined
  )
}

/**
 * Normalize a {@link DbFactory} return value to `{ db, dispose? }` so
 * call sites don't repeat the `isDisposableDb` shape check. `dispose`
 * is `undefined` for plain `VoyantDb` factories.
 */
export function resolveDbFactoryResult(value: VoyantDb | DisposableDb): {
  db: VoyantDb
  dispose?: () => Promise<void>
} {
  if (isDisposableDb(value)) {
    return value
  }

  const dispose = dbClientDispose(value)
  return dispose ? { db: value, dispose } : { db: value }
}

/**
 * The shape returned by a custom `auth.resolve` integration. Both `userId`
 * and `actor` are required: `requireActor` is fail-closed, so a resolver
 * that omits `actor` would 401 every protected request. Make the omission a
 * compile-time error instead of a runtime mystery.
 */
export type VoyantRequestAuthContext = Omit<VoyantAuthContext, "actor"> & {
  userId: string
  actor: Actor
}

export interface LogEntry {
  method: string
  path: string
  status: number
  durationMs: number
  /** Per-request correlation id (RFC #1553), when available. */
  requestId?: string
}

export interface LoggerProvider {
  log(entry: LogEntry): void
}

export interface VoyantAuthResolveArgs<TBindings extends VoyantBindings = VoyantBindings> {
  request: Request
  env: TBindings
  db: VoyantDb
  ctx?: VoyantExecutionContext
}

export interface VoyantAuthPermissionArgs<TBindings extends VoyantBindings = VoyantBindings>
  extends VoyantAuthResolveArgs<TBindings> {
  permission: VoyantPermission
  auth: VoyantRequestAuthContext
}

export interface VoyantAuthApiKeyValidationArgs<TBindings extends VoyantBindings = VoyantBindings>
  extends VoyantAuthResolveArgs<TBindings> {
  apiKey: SelectApikey
}

export interface VoyantAuthIntegration<TBindings extends VoyantBindings = VoyantBindings> {
  handler?: (env: TBindings) => {
    fetch: (
      req: Request,
      env: TBindings,
      ctx?: VoyantExecutionContext,
    ) => Response | Promise<Response>
  }
  /**
   * Resolve the request to an auth context, or return `null` for anonymous.
   *
   * The returned object MUST include `actor` — `requireActor` is fail-closed,
   * so omitting it 401s every protected route. For single-tenant admin apps
   * where every authenticated session is staff, return `actor: "staff"`.
   * Customer/partner/supplier sessions should return the corresponding actor
   * so `/v1/public/*` route guards work.
   */
  resolve?: (
    args: VoyantAuthResolveArgs<TBindings>,
  ) => Promise<VoyantRequestAuthContext | null> | VoyantRequestAuthContext | null
  hasPermission?: (args: VoyantAuthPermissionArgs<TBindings>) => Promise<boolean> | boolean
  validateApiKey?: (args: VoyantAuthApiKeyValidationArgs<TBindings>) => Promise<boolean> | boolean
}

export interface VoyantAppConfig<TBindings extends VoyantBindings = VoyantBindings> {
  db: DbFactory<TBindings>
  /**
   * Optional transaction-capable db factory (e.g. a per-request Neon
   * WebSocket Pool). When provided, `createApp` routes requests by
   * surface: routes of modules declaring `requiresTransactionalDb` (plus
   * any `dbTransactionalPaths`) get this factory; every other request is
   * served by the cheap `db` factory (typically neon-http — zero
   * connection handshake). When omitted, `db` serves everything
   * (previous behavior).
   */
  dbTransactional?: DbFactory<TBindings>
  /**
   * Extra path prefixes that must receive the transactional client —
   * for starter-owned routes mounted via `additionalRoutes` that run
   * interactive transactions (e.g. `"/api/checkout"`). Only meaningful
   * together with `dbTransactional`.
   */
  dbTransactionalPaths?: string[]
  modules?: HonoModule[]
  extensions?: HonoExtension[]
  plugins?: HonoBundleInput[]
  eventBus?: EventBus
  link?: LinkService
  query?: QueryGraphContext | VoyantQueryRuntime
  auth?: VoyantAuthIntegration<TBindings>
  /**
   * Hosting/deployment prefix to strip before app-local path decisions such as
   * auth publicPaths, public-write rate limiting, actor guards, and DB surface
   * selection. Example: a Hono app mounted at `/api` still declares routes and
   * publicPaths as `/v1/...`, so set `basePath: "/api"`.
   */
  basePath?: string
  publicPaths?: string[]
  logger?: LoggerProvider
  /**
   * Observability sink for unhandled exceptions at framework catch points
   * (RFC #1553). Receives a normalized `{ requestId, app, error, context }`
   * event for every 5xx — the `requestId` matches the one surfaced to the user
   * on `X-Request-Id`, so a reported reference is findable in the backend.
   * Defaults to a no-op (zero vendor coupling). Supply a `Reporter` — a
   * Sentry/OpenTelemetry adapter, or the built-in `consoleReporter` — to wire a
   * backend. The framework owns the catch points + event shape; the sink is a
   * deployment choice.
   */
  reporter?: Reporter
  /**
   * Logical name for this app/worker, stamped on emitted error events and used
   * for log correlation. Defaults to `"voyant"`.
   */
  appName?: string
  /**
   * Shared response cache for the public surface (`/v1/public/*` by
   * default). Enabled by default but inert until a route marks its
   * response `Cache-Control: public, s-maxage=…` — personalized routes
   * are never cached. Set `false` to disable, or pass options to tune
   * prefixes/limits. Uses the Cache API where the runtime provides it
   * and falls back to the `env.CACHE` KV binding (Voyant Cloud
   * namespaced workers have no `caches.default`).
   */
  publicCache?: false | import("./middleware/public-cache.js").PublicCacheOptions
  /**
   * Transactional outbox (RFC #1687 Phase 2.1). When `true`, request
   * emits persist the envelope to the `event_outbox` table BEFORE any
   * subscriber runs (durable, at-least-once with retry/dead-letter via
   * `drainOutbox` from `@voyant-travel/db/outbox`). Requires the
   * `event_outbox` migration. Deployments should run a periodic drain
   * (cron) for redelivery of failed/interrupted deliveries:
   * `drainOutbox(db, app.eventBus)`. Services needing write atomicity
   * insert rows inside their own transaction via
   * `insertOutboxEvents(tx, ...)`. Default off.
   */
  outbox?: boolean
  /**
   * Per-request metrics to the `env.METRICS` Analytics Engine dataset
   * (method, route pattern, surface, cache status, duration, status,
   * db query count). Enabled by default and inert without the binding;
   * set `false` to disable entirely.
   */
  metrics?: boolean
  /**
   * Default request body limit enforced before route handlers parse
   * JSON/form data. Content-type-aware: JSON bodies are capped at 10 MiB
   * (`jsonMaxBytes`), non-JSON bodies (uploads) at the 26 MiB outer ceiling
   * (`maxBytes`). Set `false` to disable, or override either cap.
   */
  requestBodyLimit?: false | { maxBytes?: number; jsonMaxBytes?: number }
  /**
   * Default app-wide security headers. Enabled by default. Set `false`
   * to disable, or override CSP/HSTS via the option object.
   */
  securityHeaders?: false | import("./middleware/security-headers.js").SecurityHeadersOptions
  /**
   * Default app-wide rate limits. Enabled by default for `/auth/*` POSTs
   * and unauthenticated public writes. Set `false` to disable or tune
   * individual policies.
   */
  rateLimit?: false | import("./middleware/rate-limit.js").RateLimitConfig
  /**
   * Workflow runtime configuration. When set, `createApp()` collects
   * `module.workflows` + `module.eventFilters` (plus the same fields
   * from plugins), invokes `workflows.driver` with framework deps, and
   * — inside the lazy bootstrap path — registers the manifest with the
   * driver and installs an EventBus forwarder that routes emitted
   * events to `driver.ingestEvent(...)`.
   *
   * See `docs/architecture/workflows-runtime-architecture.md` §6, §18.
   */
  workflows?: VoyantWorkflowsConfig
  /**
   * Admin API capability metadata, served at `GET /v1/admin/_meta/capabilities`
   * so clients (the admin SDK) can discover what this deployment supports —
   * enabled modules, available operations, contract/deployment version, and the
   * caller's resolved actor + scopes. Provide it from `@voyant-travel/admin-contracts`:
   * `{ contractVersion: ADMIN_CONTRACT_VERSION, operations: operationCapabilities() }`.
   * When omitted, the route is not mounted. Typed structurally so `@voyant-travel/hono`
   * stays decoupled from `@voyant-travel/admin-contracts`.
   */
  adminMeta?: {
    contractVersion: string
    deploymentVersion?: string
    operations: ReadonlyArray<{
      id: string
      method: string
      pathTemplate: string
      classification: string
      scopes: string[]
      capabilityKey?: string
    }>
  }
  // biome-ignore lint/suspicious/noExplicitAny: reason: Hono sub-apps need to accept host-specific binding and variable generics.
  additionalRoutes?: (app: Hono<any>) => void
}

/**
 * Workflow runtime configuration block. The driver is resolved at boot
 * time (inside the lazy bootstrap path), after framework deps and —
 * crucially — after runtime bindings are available.
 *
 * `driver` is **always** a function-of-bindings: `(env) => DriverFactory`.
 * This unambiguous shape works for local node runtimes and managed-cloud
 * forwarding drivers:
 *
 * **Node / InMemory** — wrap your direct factory:
 *
 *     workflows: {
 *       driver: () => createStandaloneDriver({ db }),
 *     }
 *
 * **Managed Cloud forwarding** — pull credentials off `env`:
 *
 *     workflows: {
 *       driver: (env) => () => createCloudWorkflowDriver({
 *         baseUrl: env.VOYANT_CLOUD_WORKFLOWS_URL,
 *         triggerToken: env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN,
 *         appSlug: env.VOYANT_CLOUD_APP_SLUG,
 *         environment: env.VOYANT_CLOUD_ENVIRONMENT,
 *       }),
 *     }
 *
 * The single shape avoids ambiguous "is this a factory or a
 * factory-of-factories?" heuristics. See architecture doc §6.3 +
 * reviewer feedback P2.1.
 */
export interface VoyantWorkflowsConfig<TBindings = unknown> {
  /**
   * Function-of-bindings that returns a `DriverFactory`. Resolved
   * lazily with `c.env` once bindings are available, then invoked
   * with `{ services, logger }` to produce the driver.
   */
  driver: (bindings: TBindings) => DriverFactory
  /**
   * Environment the manifest registers under. Defaults to `"development"`.
   * Workflow filters are environment-scoped (production manifests don't
   * see preview events and vice versa) per architecture doc §21.10.
   */
  environment?: "production" | "preview" | "development"
  /**
   * Project / tenant identifier baked into the manifest. Single-tenant
   * runtimes leave this unset (defaults to `"default"`). Multi-tenant
   * deployments override per-app via voyant-cloud's wrapper layer.
   */
  projectId?: string
}

/**
 * Structural shape of a `DriverFactory` from `@voyant-travel/workflows/driver`.
 * The SDK package's concrete `DriverFactory` satisfies this via TS
 * structural compat (architecture doc §21.19).
 */
