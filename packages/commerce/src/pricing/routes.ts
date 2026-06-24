import { OpenAPIHono } from "@hono/zod-openapi"

import { pricingCoreRoutes } from "./routes-core.js"
import type { publicPricingRoutes } from "./routes-public.js"
import { pricingRuleRoutes } from "./routes-rules.js"
import type { Env } from "./routes-shared.js"

// `OpenAPIHono` so the migrated `pricingCoreRoutes` `.openapi()` operations
// propagate through `.route("/")` into the composed OpenAPI registry
// (voyant#2114). `pricingRuleRoutes` is still a plain Hono and contributes no
// docs yet — it mounts fine for runtime dispatch (Admin batch follow-up).
export const pricingRoutes = new OpenAPIHono<Env>()
pricingRoutes.route("/", pricingCoreRoutes)
pricingRoutes.route("/", pricingRuleRoutes)

export type PricingRoutes = typeof pricingRoutes
export type PublicPricingRoutes = typeof publicPricingRoutes
