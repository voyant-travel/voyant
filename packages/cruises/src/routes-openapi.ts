import { createRoute, type RouteConfig } from "@hono/zod-openapi"

export const CRUISES_OPENAPI_API_IDS = {
  admin: "@voyant-travel/cruises#api.admin",
  public: "@voyant-travel/cruises#api.public",
} as const

function createCruisesRoute<P extends string, R extends Omit<RouteConfig, "path"> & { path: P }>(
  apiId: string,
  route: R,
) {
  return createRoute({
    "x-voyant-api-id": apiId,
    ...route,
  })
}

export function createCruisesAdminRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createCruisesRoute(CRUISES_OPENAPI_API_IDS.admin, route)
}

export function createCruisesPublicRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createCruisesRoute(CRUISES_OPENAPI_API_IDS.public, route)
}
