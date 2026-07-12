import { createRoute, type RouteConfig } from "@hono/zod-openapi"

const BOOKINGS_ADMIN_API_ID = "@voyant-travel/bookings#api.admin"

export function createBookingsAdminRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createRoute({
    "x-voyant-api-id": BOOKINGS_ADMIN_API_ID,
    ...route,
  })
}
