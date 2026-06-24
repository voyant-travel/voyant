import { OpenAPIHono } from "@hono/zod-openapi"

import { pricingCoreRoutes } from "./routes-core.js"
import type { publicPricingRoutes } from "./routes-public.js"
import { pricingRuleRoutes } from "./routes-rules.js"
import type { Env } from "./routes-shared.js"

// `OpenAPIHono` so the migrated `pricingCoreRoutes` and `pricingRuleRoutes`
// `.openapi()` operations propagate through `.route("/")` into the composed
// OpenAPI registry (voyant#2114 / voyant#2208).
export const pricingRoutes = new OpenAPIHono<Env>()
pricingRoutes.route("/", pricingCoreRoutes)
pricingRoutes.route("/", pricingRuleRoutes)

export type PricingRoutes = typeof pricingRoutes
export type PublicPricingRoutes = typeof publicPricingRoutes
