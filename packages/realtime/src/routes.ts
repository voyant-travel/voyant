import { OpenAPIHono } from "@hono/zod-openapi"
import type { Actor, ModuleContainer } from "@voyant-travel/core"
import type { Context } from "hono"

import {
  type PortalScope,
  type RealtimeCapabilityContext,
  resolveRealtimeCapabilities,
} from "./capabilities.js"
import { createRealtimeService, type RealtimeService } from "./service.js"
import type { RealtimeProvider } from "./types.js"

export const REALTIME_ROUTE_RUNTIME_CONTAINER_KEY = "providers.realtime.runtime"
export const REALTIME_OPENAPI_API_IDS = {
  admin: "@voyant-travel/realtime#api.admin",
  public: "@voyant-travel/realtime#api.public",
} as const

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    actor?: Actor
    userId?: string
  }
}

/** Resolves the portal ownership scope for a non-staff session. */
export type ResolvePortalScope = (
  c: Context<Env>,
) => Promise<PortalScope | null> | PortalScope | null

export interface RealtimeRoutesOptions {
  /** Transport(s) used to mint client tokens. First is the default. */
  providers?: ReadonlyArray<RealtimeProvider>
  /** Resolve providers from runtime bindings (e.g. a Cloud client from env). */
  resolveProviders?: (bindings: Record<string, unknown>) => ReadonlyArray<RealtimeProvider>
  /**
   * Resolve the bookings/person a portal session owns. Required for customers
   * to receive `portal:customer:*` / `booking:*` capabilities; without it they
   * only get their personal `notifications:user:*` channel.
   */
  resolvePortalScope?: ResolvePortalScope
  /** Default token lifetime in seconds. */
  defaultTtlSeconds?: number
}

export interface RealtimeRouteRuntime {
  /** Null when no provider is configured — the module stays inert/optional. */
  service: RealtimeService | null
  resolvePortalScope?: ResolvePortalScope
  defaultTtlSeconds?: number
}

export function buildRealtimeRouteRuntime(
  bindings: Record<string, unknown>,
  options: RealtimeRoutesOptions = {},
): RealtimeRouteRuntime {
  const providers = options.resolveProviders
    ? options.resolveProviders(bindings)
    : (options.providers ?? [])
  return {
    // Tolerate zero providers (e.g. no API key configured): the token route
    // returns no content and the bridge registers nothing, rather than failing app boot.
    service: providers.length > 0 ? createRealtimeService(providers) : null,
    resolvePortalScope: options.resolvePortalScope,
    defaultTtlSeconds: options.defaultTtlSeconds,
  }
}

function getRuntime(c: Context<Env>): RealtimeRouteRuntime | undefined {
  const container = c.get("container")
  if (!container?.has(REALTIME_ROUTE_RUNTIME_CONTAINER_KEY)) {
    return undefined
  }
  return container.resolve<RealtimeRouteRuntime>(REALTIME_ROUTE_RUNTIME_CONTAINER_KEY)
}

/**
 * Routes that mint short-lived, capability-scoped client tokens from the
 * caller's session. Mounted as both `adminRoutes` and `publicRoutes`: the app's
 * actor guards ensure `/v1/admin/*` carries a staff actor and `/v1/public/*` a
 * customer/partner/supplier actor, and {@link resolveRealtimeCapabilities}
 * scopes the token accordingly.
 */
export function createRealtimeRoutes(
  options: RealtimeRoutesOptions = {},
  apiId: (typeof REALTIME_OPENAPI_API_IDS)[keyof typeof REALTIME_OPENAPI_API_IDS] = REALTIME_OPENAPI_API_IDS.admin,
): OpenAPIHono<Env> {
  // Eager runtime when providers are passed directly; otherwise rely on the
  // container runtime registered at bootstrap (bindings-derived providers).
  const eagerRuntime =
    options.providers && !options.resolveProviders
      ? buildRealtimeRouteRuntime({}, options)
      : undefined

  const routes = new OpenAPIHono<Env>()
  routes.post("/token", async (c) => {
    const runtime = eagerRuntime ?? getRuntime(c)
    if (!runtime?.service) {
      return c.body(null, 204)
    }
    const service = runtime.service

    const actor = c.get("actor")
    const userId = c.get("userId")
    if (!userId || !actor) {
      return c.json({ error: "Authentication required" }, 401)
    }

    const portalScope =
      actor !== "staff" && runtime.resolvePortalScope ? await runtime.resolvePortalScope(c) : null

    const capabilityCtx: RealtimeCapabilityContext = { actor, userId, portalScope }
    const capabilities = resolveRealtimeCapabilities(capabilityCtx)

    const minted = await service.mintClientToken({
      clientId: userId,
      capabilities,
      ttlSeconds: runtime.defaultTtlSeconds,
    })

    return c.json({
      data: {
        token: minted.token,
        expiresAt: minted.expiresAt,
        capabilities,
        provider: service.defaultProvider.name,
      },
    })
  })
  routes.openAPIRegistry.registerPath({
    method: "post",
    path: "/token",
    summary: "Mint a realtime client token",
    responses: {
      200: { description: "A short-lived capability-scoped client token." },
      204: { description: "Realtime is not configured for this deployment." },
      401: { description: "Authentication is required." },
    },
    "x-voyant-api-id": apiId,
  })
  return routes
}
