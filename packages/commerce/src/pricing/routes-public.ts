import { parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { type Env, notFound } from "./routes-shared.js"
import { publicPricingService } from "./service-public.js"
import {
  publicAvailabilitySnapshotQuerySchema,
  publicProductPricingQuerySchema,
} from "./validation-public.js"

export const publicPricingRoutes = new Hono<Env>()
  .get("/products/:productId/pricing", async (c) => {
    const snapshot = await publicPricingService.getProductPricingSnapshot(
      c.get("db"),
      c.req.param("productId"),
      parseQuery(c, publicProductPricingQuerySchema),
    )

    return snapshot ? c.json({ data: snapshot }) : notFound(c, "Public pricing snapshot not found")
  })
  .get("/products/:productId/availability", async (c) => {
    const snapshot = await publicPricingService.getAvailabilitySnapshot(
      c.get("db"),
      c.req.param("productId"),
      parseQuery(c, publicAvailabilitySnapshotQuerySchema),
    )

    return snapshot ? c.json(snapshot) : notFound(c, "Public availability snapshot not found")
  })

export type PublicPricingRoutes = typeof publicPricingRoutes
