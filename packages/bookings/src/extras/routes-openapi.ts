import { createRoute, type RouteConfig } from "@hono/zod-openapi"

export const BOOKINGS_EXTRAS_OPENAPI_API_ID = "@voyant-travel/bookings#extras.api"

export function createBookingsExtrasRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createRoute({
    "x-voyant-api-id": BOOKINGS_EXTRAS_OPENAPI_API_ID,
    ...route,
  })
}
