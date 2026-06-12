import type { Actor } from "@voyantjs/core"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyantjs/types/api-keys"
import type { MiddlewareHandler } from "hono"

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
}> {
  if (allowed.length === 0) {
    throw new Error("requireActor: must specify at least one allowed actor")
  }
  const allowSet = new Set<Actor>(allowed)

  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next()

    if (c.get("callerType") === "api_key" || c.get("callerType") === "internal") {
      const resource = apiKeyResourceFromPath(new URL(c.req.url).pathname)

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

    return next()
  }
}
