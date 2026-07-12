import { createRoute, type RouteConfig } from "@hono/zod-openapi"

export const CHARTERS_PUBLIC_OPENAPI_API_ID = "@voyant-travel/charters#api.public"

export function createChartersPublicRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createRoute({
    "x-voyant-api-id": CHARTERS_PUBLIC_OPENAPI_API_ID,
    ...route,
  })
}
