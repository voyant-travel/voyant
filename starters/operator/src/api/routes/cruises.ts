/**
 * Cruise admin/public route mounting for the operator starter.
 *
 * The `@voyant-travel/cruises` package ships `cruiseAdminRoutes` /
 * `cruisePublicRoutes` but does not mount them — a deployment opts in. We mount
 * them through a thin wrapper that injects the booking-engine
 * `SourceAdapterRegistry` into the Hono context (`c.set("sourceAdapterRegistry",
 * …)`) before the package routes run, because the cruise external detail /
 * refresh handlers (`routes-detail.ts`) dispatch through that registry and 503
 * without it. Resolving the registry here is also the single activation point
 * for cruise adapters: `getBookingEngineRegistryFromContext` builds the cached
 * registry, which runs `registerCruiseAdapters` (both planes) on first touch.
 *
 * The package routes are mounted at `/v1/admin/cruises` and `/v1/public/cruises`
 * by the framework (module name → prefix). They coexist with the catalog
 * content routes already mounted there (`/:id/content`) — the paths don't
 * overlap.
 */

import { cruisePublicRoutes } from "@voyant-travel/cruises/public-routes"
import { cruiseAdminRoutes } from "@voyant-travel/cruises/routes"
import { Hono } from "hono"

import { getBookingEngineRegistryFromContext } from "../lib/booking-engine-runtime"

// The route bundle the module factory mounts. The package routes carry their own
// per-route Env, so the wrapper stays env-agnostic.
// biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: operator; matches the framework route-bundle convention (packages/hono module.ts).
type RouteBundle = Hono<any>

function withSourceAdapterRegistry(routes: RouteBundle): RouteBundle {
  const wrapped: RouteBundle = new Hono()
  wrapped.use("*", async (c, next) => {
    c.set("sourceAdapterRegistry", getBookingEngineRegistryFromContext(c))
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
