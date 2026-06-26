/**
 * Admin product maintenance routes (recalculate cost + margin) — mounted by the
 * operator starter under `/v1/admin/products/...` (staff-actor gated by the
 * parent app's middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory core sub-batch). The recalculate response is the rolled-up
 * `{ costAmountCents, marginPercent }` (both integer cents/percent — §17). Its
 * `.openapi()` operation propagates up through the parent `productRoutes`
 * registry.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"

import type { Env } from "./route-env.js"
import { productsService } from "./service.js"

const errorResponseSchema = z.object({ error: z.string() })

const recalculateResultSchema = z.object({
  costAmountCents: z.number().int(),
  marginPercent: z.number().int(),
})

const recalculateProductRoute = createRoute({
  method: "post",
  path: "/{id}/recalculate",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The recalculated product cost and margin",
      content: { "application/json": { schema: z.object({ data: recalculateResultSchema }) } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const productMaintenanceRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  // POST /{id}/recalculate — Recalculate product cost and margin
  .openapi(recalculateProductRoute, async (c) => {
    const result = await productsService.recalculate(c.get("db"), c.req.valid("param").id)

    if (!result) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: result }, 200)
  })
