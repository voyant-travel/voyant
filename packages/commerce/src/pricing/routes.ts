import { Hono } from "hono"

import { pricingCoreRoutes } from "./routes-core.js"
import type { publicPricingRoutes } from "./routes-public.js"
import { pricingRuleRoutes } from "./routes-rules.js"
import type { Env } from "./routes-shared.js"

export const pricingRoutes = new Hono<Env>()
pricingRoutes.route("/", pricingCoreRoutes)
pricingRoutes.route("/", pricingRuleRoutes)

export type PricingRoutes = typeof pricingRoutes
export type PublicPricingRoutes = typeof publicPricingRoutes
