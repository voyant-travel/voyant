import { OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook, parseQuery } from "@voyant-travel/hono"
import type { Context } from "hono"
import { createPricingPublicRoute } from "./routes-openapi.js"
import { type Env, notFound } from "./routes-shared.js"
import { publicPricingService } from "./service-public.js"
import {
  publicAvailabilitySnapshotQuerySchema,
  publicProductPricingQuerySchema,
  publicProductPricingSnapshotSchema,
} from "./validation-public.js"

const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

function cachePublicRead(c: Context) {
  c.header("Cache-Control", PUBLIC_CACHE_CONTROL)
}

const productPricingRoute = createPricingPublicRoute({
  method: "get",
  path: "/products/{productId}/pricing",
  request: {
    params: z.object({ productId: z.string() }),
    query: publicProductPricingQuerySchema,
  },
  responses: {
    200: {
      description: "Public pricing snapshot for a product",
      content: {
        "application/json": { schema: z.object({ data: publicProductPricingSnapshotSchema }) },
      },
    },
    404: {
      description: "Product or pricing snapshot not found",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
})

export const publicPricingRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(productPricingRoute, async (c) => {
    const snapshot = await publicPricingService.getProductPricingSnapshot(
      c.get("db"),
      c.req.valid("param").productId,
      c.req.valid("query"),
    )

    if (!snapshot) return notFound(c, "Public pricing snapshot not found")
    cachePublicRead(c)
    return c.json({ data: snapshot }, 200)
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
