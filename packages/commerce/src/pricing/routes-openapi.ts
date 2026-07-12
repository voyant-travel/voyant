import { createRoute, type RouteConfig } from "@hono/zod-openapi"

export const PRICING_PUBLIC_OPENAPI_API_ID = "@voyant-travel/commerce#api.pricing.public"

export function createPricingPublicRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(route: R) {
  return createRoute({
    "x-voyant-api-id": PRICING_PUBLIC_OPENAPI_API_ID,
    ...route,
  })
}
