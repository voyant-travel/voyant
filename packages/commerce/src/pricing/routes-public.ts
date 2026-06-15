import { parseQuery } from "@voyant-travel/hono"
import type { Context } from "hono"
import { Hono } from "hono"
import { type Env, notFound } from "./routes-shared.js"
import { publicPricingService } from "./service-public.js"
import {
  publicAvailabilitySnapshotQuerySchema,
  publicProductPricingQuerySchema,
} from "./validation-public.js"

const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

function cachePublicRead(c: Context) {
  c.header("Cache-Control", PUBLIC_CACHE_CONTROL)
}

export const publicPricingRoutes = new Hono<Env>()
  .get("/products/:productId/pricing", async (c) => {
    const snapshot = await publicPricingService.getProductPricingSnapshot(
      c.get("db"),
      c.req.param("productId"),
      parseQuery(c, publicProductPricingQuerySchema),
    )

    if (!snapshot) return notFound(c, "Public pricing snapshot not found")
    cachePublicRead(c)
    return c.json({ data: snapshot })
  })
  .get("/products/:productId/availability", async (c) => {
    const snapshot = await publicPricingService.getAvailabilitySnapshot(
      c.get("db"),
      c.req.param("productId"),
      parseQuery(c, publicAvailabilitySnapshotQuerySchema),
    )

    if (!snapshot) return notFound(c, "Public availability snapshot not found")
    cachePublicRead(c)
    return c.json(snapshot)
  })

export type PublicPricingRoutes = typeof publicPricingRoutes
