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

export type VoyantDb = PostgresJsDatabase | NeonHttpDatabase
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

export type DbFactory<TBindings extends VoyantBindings = VoyantBindings> = (
  env: TBindings,
) => VoyantDb

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
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics
  additionalRoutes?: (app: Hono<any>) => void
}
