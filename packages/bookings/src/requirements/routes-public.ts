import { OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { createBookingRequirementsPublicRoute } from "./routes-openapi.js"
import { bookingRequirementsService } from "./service.js"
import type { ResolveBookingRequirementsProductSnapshot } from "./service-public.js"
import {
  publicTransportRequirementsQuerySchema,
  publicTransportRequirementsSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const PUBLIC_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600"

function cachePublicRead(c: Context) {
  c.header("Cache-Control", PUBLIC_CACHE_CONTROL)
}

const transportRequirementsRoute = createBookingRequirementsPublicRoute({
  method: "get",
  path: "/products/{productId}/transport-requirements",
  request: {
    params: z.object({ productId: z.string() }),
    query: publicTransportRequirementsQuerySchema,
  },
  responses: {
    200: {
      description: "Public transport requirements for a product",
      content: {
        "application/json": { schema: z.object({ data: publicTransportRequirementsSchema }) },
      },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
})

export interface PublicBookingRequirementsRoutesOptions {
  resolveProductSnapshot?: ResolveBookingRequirementsProductSnapshot
}

export function createPublicBookingRequirementsRoutes(
  options: PublicBookingRequirementsRoutesOptions = {},
) {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook }).openapi(
    transportRequirementsRoute,
    async (c) => {
      const result = await bookingRequirementsService.getPublicTransportRequirements(
        c.get("db"),
        c.req.valid("param").productId,
        c.req.valid("query"),
        options.resolveProductSnapshot,
      )

      if (!result) {
        return c.json({ error: "Product not found" }, 404)
      }

      cachePublicRead(c)
      return c.json({ data: result }, 200)
    },
  )
}

export const publicBookingRequirementsRoutes = createPublicBookingRequirementsRoutes()

export type PublicBookingRequirementsRoutes = typeof publicBookingRequirementsRoutes
