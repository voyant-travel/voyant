import { parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { bookingRequirementsService } from "./service.js"
import type { ResolveBookingRequirementsProductSnapshot } from "./service-public.js"
import { publicTransportRequirementsQuerySchema } from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export interface PublicBookingRequirementsRoutesOptions {
  resolveProductSnapshot?: ResolveBookingRequirementsProductSnapshot
}

export function createPublicBookingRequirementsRoutes(
  options: PublicBookingRequirementsRoutesOptions = {},
) {
  return new Hono<Env>().get("/products/:productId/transport-requirements", async (c) => {
    const query = await parseQuery(c, publicTransportRequirementsQuerySchema)

    const result = await bookingRequirementsService.getPublicTransportRequirements(
      c.get("db"),
      c.req.param("productId"),
      query,
      options.resolveProductSnapshot,
    )

    if (!result) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: result })
  })
}

export const publicBookingRequirementsRoutes = createPublicBookingRequirementsRoutes()

export type PublicBookingRequirementsRoutes = typeof publicBookingRequirementsRoutes
