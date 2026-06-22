/**
 * Cruise admin/public route mounting for the operator starter.
 *
 * The `@voyant-travel/cruises` package ships `cruiseAdminRoutes` /
 * `cruisePublicRoutes` but does not mount them — a deployment opts in. We mount
 * them through a thin wrapper that injects the booking-engine
 * `SourceAdapterRegistry` into the Hono context (`c.set("sourceAdapterRegistry",
 * …)`) before the package routes run, because the cruise external detail /
 * refresh handlers (`routes-detail.ts`) dispatch through that registry and 503
 * without it.
 *
 * The wrapper `await`s `ensureBookingEngineRegistry` (NOT the non-blocking
 * `getBookingEngineRegistryFromContext`): the public/admin cruise routes resolve
 * external providers SYNCHRONOUSLY via `resolveCruiseAdapter(row.sourceProvider)`
 * (e.g. `routes-public.ts`), and the per-connection Voyant Connect cruise adapters
 * — whose `name` is the connection's `sourceProvider` — are only back-filled into
 * the vertical registry inside the async Connect warm. Without awaiting, a cold
 * isolate would return `adapter_not_registered` for provider-specific Connect rows
 * until the background warm settled. The warm is memoized per isolate, so only the
 * first cruise request on a cold isolate pays the enumeration latency.
 *
 * The package routes are mounted at `/v1/admin/cruises` and `/v1/public/cruises`
 * by the framework (module name → prefix). They coexist with the catalog
 * content routes already mounted there (`/:id/content`) — the paths don't
 * overlap.
 */

import { cruisePublicRoutes } from "@voyant-travel/cruises/public-routes"
import { cruiseAdminRoutes } from "@voyant-travel/cruises/routes"
import { Hono } from "hono"

import { type BookingEngineEnv, ensureBookingEngineRegistry } from "../lib/booking-engine-runtime"

// The route bundle the module factory mounts. The package routes carry their own
// per-route Env, so the wrapper stays env-agnostic.
// biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: operator; matches the framework route-bundle convention (packages/hono module.ts).
type RouteBundle = Hono<any>

function withSourceAdapterRegistry(routes: RouteBundle): RouteBundle {
  const wrapped: RouteBundle = new Hono()
  wrapped.use("*", async (c, next) => {
    // Await the Connect warm so per-connection cruise providers are resolvable
    // synchronously by the package routes (see the file header).
    const registry = await ensureBookingEngineRegistry(c.env as BookingEngineEnv)
    c.set("sourceAdapterRegistry", registry)
    await next()
  })
  wrapped.route("/", routes)
  return wrapped
}

export function createCruiseAdminRoutes(): RouteBundle {
  return withSourceAdapterRegistry(cruiseAdminRoutes)
}

export function createCruisePublicRoutes(): RouteBundle {
  return withSourceAdapterRegistry(cruisePublicRoutes)
}
