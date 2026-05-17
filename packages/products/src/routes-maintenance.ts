import { Hono } from "hono"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"

export const productMaintenanceRoutes = new Hono<Env>()
  // ==========================================================================
  // Recalculate
  // ==========================================================================

  // POST /:id/recalculate — Recalculate product cost and margin
  .post("/:id/recalculate", async (c) => {
    const result = await productsService.recalculate(c.get("db"), c.req.param("id"))

    if (!result) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: result })
  })
