import { createRoute, type RouteConfig } from "@hono/zod-openapi"

export const MARKETS_PUBLIC_OPENAPI_API_ID = "@voyant-travel/commerce#api.markets.public"

export function createMarketsPublicRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createRoute({
    "x-voyant-api-id": MARKETS_PUBLIC_OPENAPI_API_ID,
    ...route,
  })
}
