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
} from "@voyantjs/core"
import type { KVStore } from "@voyantjs/utils/cache"
import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import type { NeonDatabase as NeonWsDatabase } from "drizzle-orm/neon-serverless"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Hono } from "hono"

import type { HonoExtension, HonoModule } from "./module.js"
import type { HonoBundle } from "./plugin.js"

export interface VoyantExecutionContext {
  waitUntil?: (promise: Promise<unknown>) => void
  passThroughOnException?: () => void
}

export interface VoyantBindings {
  INTERNAL_API_KEY?: string
  SESSION_CLAIMS_SECRET?: string
  BETTER_AUTH_SECRET?: string
  DATABASE_URL: string
  CORS_ALLOWLIST?: string
  APP_URL?: string
  DASH_BASE_URL?: string
  API_BASE_URL?: string
  RATE_LIMIT?: KVStore
  CACHE?: KVStore
}

export type VoyantDb = PostgresJsDatabase | NeonHttpDatabase | NeonWsDatabase
export type VoyantQueryRuntime = QueryRunner

export type VoyantVariables = CoreVoyantVariables & {
  db: VoyantDb
  /** Shared app/runtime container for explicit service resolution. */
  container: ModuleContainer
  eventBus: EventBus
  /** Shared cross-module link runtime, when the app wires one in. */
  link?: LinkService
  /** Shared cross-module query runtime, when the app wires one in. */
  query?: VoyantQueryRuntime
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
  return isDisposableDb(value) ? value : { db: value }
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
}

export interface VoyantAppConfig<TBindings extends VoyantBindings = VoyantBindings> {
  db: DbFactory<TBindings>
  modules?: HonoModule[]
  extensions?: HonoExtension[]
  plugins?: HonoBundle[]
  eventBus?: EventBus
  link?: LinkService
  query?: QueryGraphContext | VoyantQueryRuntime
  auth?: VoyantAuthIntegration<TBindings>
  publicPaths?: string[]
  logger?: LoggerProvider
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
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics
  additionalRoutes?: (app: Hono<any>) => void
}

/**
 * Workflow runtime configuration block. The driver factory is invoked
 * once per `createApp()` instance, after the framework's
 * `ModuleContainer` is built — see architecture doc §6.3 (`DriverFactory`).
 */
export interface VoyantWorkflowsConfig {
  /**
   * `DriverFactory` returned from one of `@voyantjs/workflows-orchestrator`'s
   * factories (`createInMemoryDriver`), `@voyantjs/workflows-orchestrator-node`
   * (`createNodeStandaloneDriver`), or
   * `@voyantjs/workflows-orchestrator-cloudflare` (`createCloudflareEdgeDriver`).
   */
  // biome-ignore lint/suspicious/noExplicitAny: DriverFactory's TIn/TOut generics vary across drivers
  driver: (deps: { services: any; logger: any; now?: () => number }) => any
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
