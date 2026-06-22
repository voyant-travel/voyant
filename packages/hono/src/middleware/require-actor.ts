import type { Actor } from "@voyant-travel/core"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyant-travel/types/api-keys"
import type { MiddlewareHandler } from "hono"

import { normalizePathname } from "../lib/public-paths.js"
import type { VoyantBindings, VoyantVariables } from "../types.js"

function apiKeyResourceFromPath(pathname: string): string | null {
  const surfaceMatch = pathname.match(/^\/v1\/(?:admin|public)\/([^/]+)/)
  if (surfaceMatch?.[1]) return surfaceMatch[1]
  const legacyMatch = pathname.match(/^\/v1\/([^/]+)/)
  if (legacyMatch?.[1] && legacyMatch[1] !== "admin" && legacyMatch[1] !== "public") {
    return legacyMatch[1]
  }
  return null
}

function apiKeyPermissionActionsForMethod(method: string): string[] {
  switch (method.toUpperCase()) {
    case "GET":
    case "HEAD":
      return ["read", "search"]
    case "POST":
      return ["write", "trigger", "relay"]
    case "PUT":
    case "PATCH":
      return ["write"]
    case "DELETE":
      return ["delete"]
    default:
      return []
  }
}

function hasAnyApiKeyPermission(
  scopes: string[] | null | undefined,
  resource: string,
  actions: string[],
) {
  if (!scopes || scopes.length === 0) return false
  const permissions = permissionStringsToPermissions(scopes)
  return actions.some((action) => hasApiKeyPermission(permissions, resource, action))
}

/**
 * Staff-session RBAC enforcement (member-rbac-rfc, voyant#2085). Enforced **by
 * default**: every member's assigned scope set is checked across admin routes.
 * Full-access members hold `*` and bypass, so they're unaffected. The
 * `VOYANT_RBAC_ENFORCE` env var is a kill switch — set it to `0`/`false`/`off`
 * to disable enforcement (e.g. an emergency rollback) without a code change.
 * API-key scope enforcement is always on (unchanged).
 */
export function isStaffRbacEnforced(env: unknown): boolean {
  const value = (env as { VOYANT_RBAC_ENFORCE?: string } | undefined)?.VOYANT_RBAC_ENFORCE
  const normalized = value?.trim().toLowerCase()
  return !(normalized === "0" || normalized === "false" || normalized === "off")
}

export interface RequireActorOptions {
  /**
   * Deployment prefix stripped before deriving API-key/staff RBAC resources.
   * Keep this aligned with the app-level auth/public-path basePath.
   */
  basePath?: string
}

function isRequireActorOptions(value: unknown): value is RequireActorOptions {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Guards a route surface by actor type.
 *
 * Voyant exposes two API surfaces:
 * - `/v1/admin/*` — operator staff (`"staff"`)
 * - `/v1/public/*` — customers, partners, suppliers
 *
 * Requests carry an `actor` on `c.var`, typically set by `requireAuth` or a
 * custom `auth.resolve` integration.
 *
 * When the caller has no resolved actor, this middleware returns `401
 * Unauthorized`. Earlier versions defaulted unset callers to `"staff"` for
 * backwards compatibility, but that meant a misordered or missing auth
 * middleware silently granted operator privileges to anonymous traffic.
 * The default is now fail-closed.
 *
 * @example
 * app.use("/v1/admin/*", requireActor("staff"))
 * app.use("/v1/public/*", requireActor("customer", "partner", "supplier"))
 */
export function requireActor<TBindings extends VoyantBindings = VoyantBindings>(
  ...allowed: Actor[]
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: VoyantVariables
}>
export function requireActor<TBindings extends VoyantBindings = VoyantBindings>(
  options: RequireActorOptions,
  ...allowed: Actor[]
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: VoyantVariables
}>
export function requireActor<TBindings extends VoyantBindings = VoyantBindings>(
  ...args: [RequireActorOptions, ...Actor[]] | Actor[]
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: VoyantVariables
}> {
  const options = isRequireActorOptions(args[0]) ? args[0] : {}
  const allowed = (isRequireActorOptions(args[0]) ? args.slice(1) : args) as Actor[]
  if (allowed.length === 0) {
    throw new Error("requireActor: must specify at least one allowed actor")
  }
  const allowSet = new Set<Actor>(allowed)

  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next()

    if (c.get("callerType") === "api_key" || c.get("callerType") === "internal") {
      const pathname = normalizePathname(new URL(c.req.url).pathname, {
        basePath: options.basePath,
      })
      const resource = apiKeyResourceFromPath(pathname)

      // Meta/discovery endpoints (e.g. `/v1/admin/_meta/capabilities`) report
      // what the caller can do — including the key's own granted scopes — so any
      // authenticated API key may read them, regardless of module scope. `_meta`
      // is a reserved namespace (no module is named `_meta`).
      if (resource === "_meta") return next()

      const actions = apiKeyPermissionActionsForMethod(c.req.method)

      if (resource && hasAnyApiKeyPermission(c.get("scopes"), resource, actions)) {
        return next()
      }

      return c.json({ error: "Forbidden: API key missing required permission" }, 403)
    }

    const actor = c.get("actor") as Actor | undefined
    if (!actor) {
      return c.json(
        {
          error:
            "Unauthorized: actor not resolved. The auth pipeline did not assign an `actor` to this request. " +
            "If you set `auth.resolve` on `createApp({...})`, the returned object must include `actor` " +
            '(usually `"staff"` for admin sessions). Public routes should be listed in `publicPaths`.',
        },
        401,
      )
    }
    if (!allowSet.has(actor)) {
      return c.json({ error: "Forbidden: actor not permitted on this surface" }, 403)
    }

    // Granular RBAC for staff sessions (member-rbac-rfc, voyant#2085). A member
    // with an explicit, non-wildcard scope set is gated exactly like an API key:
    // resource from the path, action from the method. Full-access members hold
    // `*` (the default for unassigned members), so `hasAnyApiKeyPermission`
    // passes them — existing deployments are unaffected. Paths with no mapped
    // resource (e.g. `_meta`) stay open until a module is explicitly covered.
    if (actor === "staff" && c.get("callerType") === "session" && isStaffRbacEnforced(c.env)) {
      const scopes = c.get("scopes")
      const pathname = normalizePathname(new URL(c.req.url).pathname, {
        basePath: options.basePath,
      })
      const resource = apiKeyResourceFromPath(pathname)
      if (resource && resource !== "_meta") {
        const actions = apiKeyPermissionActionsForMethod(c.req.method)
        if (!hasAnyApiKeyPermission(scopes, resource, actions)) {
          return c.json({ error: "Forbidden: missing required permission" }, 403)
        }
      }
    }

    return next()
  }
}
