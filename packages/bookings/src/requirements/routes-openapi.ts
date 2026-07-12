import { createRoute, type RouteConfig } from "@hono/zod-openapi"

export const BOOKING_REQUIREMENTS_PUBLIC_OPENAPI_API_ID =
  "@voyant-travel/bookings#requirements.api.public"

export function createBookingRequirementsPublicRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createRoute({
    "x-voyant-api-id": BOOKING_REQUIREMENTS_PUBLIC_OPENAPI_API_ID,
    ...route,
  })
}
