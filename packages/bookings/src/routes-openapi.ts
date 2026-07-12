import { createRoute, type RouteConfig } from "@hono/zod-openapi"

export const BOOKINGS_OPENAPI_API_IDS = {
  admin: "@voyant-travel/bookings#api.admin",
  public: "@voyant-travel/bookings#api.public",
} as const

function createBookingsRoute<P extends string, R extends Omit<RouteConfig, "path"> & { path: P }>(
  apiId: string,
  route: R,
) {
  return createRoute({
    "x-voyant-api-id": apiId,
    ...route,
  })
}

export function createBookingsAdminRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createBookingsRoute(BOOKINGS_OPENAPI_API_IDS.admin, route)
}

export function createBookingsPublicRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createBookingsRoute(BOOKINGS_OPENAPI_API_IDS.public, route)
}
