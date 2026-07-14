/**
 * Admin travel credit routes mounted by the operator starter under
 * `/v1/admin/finance/...`. Covers travel credit issuance, lookup, update, and
 * redemption.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9C). Request schemas reuse the existing
 * `@voyant-travel/finance-contracts` schemas the handlers already parse;
 * response schemas come from the shared `routes-payment-schemas.ts` row shapes
 * (authored from the Drizzle `$inferSelect` shapes; §17 dates → strings). The
 * single travel credit resource is its own `OpenAPIHono` sub-chain composed onto
 * `financeTravelCreditRoutes` via `.route("/")` so the `.openapi()` operations
 * propagate up through the parent `financeRoutes` registry.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import { errorResponseSchema } from "./routes-invoice-schemas.js"
import {
  travelCreditDetailSchema,
  travelCreditRedeemResultSchema,
  travelCreditSchema,
} from "./routes-payment-schemas.js"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import { TravelCreditServiceError } from "./service-travel-credits.js"
import {
  insertTravelCreditSchema,
  redeemTravelCreditSchema,
  travelCreditListQuerySchema,
  updateTravelCreditSchema,
} from "./validation.js"

const idParamSchema = z.object({ id: z.string() })

const listTravelCreditsRoute = createRoute({
  method: "get",
  path: "/travel-credits",
  request: { query: travelCreditListQuerySchema },
  responses: {
    200: {
      description: "List of travel credits",
      content: { "application/json": { schema: listResponseSchema(travelCreditSchema) } },
    },
  },
})

const createTravelCreditRoute = createRoute({
  method: "post",
  path: "/travel-credits",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertTravelCreditSchema } },
    },
  },
  responses: {
    201: {
      description: "The issued travel credit",
      content: { "application/json": { schema: z.object({ data: travelCreditSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "The travel credit code is already in use",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getTravelCreditRoute = createRoute({
  method: "get",
  path: "/travel-credits/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The travel credit",
      content: { "application/json": { schema: z.object({ data: travelCreditDetailSchema }) } },
    },
    404: {
      description: "Travel credit not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateTravelCreditRoute = createRoute({
  method: "patch",
  path: "/travel-credits/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateTravelCreditSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated travel credit",
      content: { "application/json": { schema: z.object({ data: travelCreditSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Travel credit not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const redeemTravelCreditRoute = createRoute({
  method: "post",
  path: "/travel-credits/{id}/redeem",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: redeemTravelCreditSchema } },
    },
  },
  responses: {
    201: {
      description: "The redemption (updated travel credit and recorded redemption row)",
      content: {
        "application/json": { schema: z.object({ data: travelCreditRedeemResultSchema }) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Travel credit not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "The travel credit has insufficient balance or an idempotency conflict",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "The travel credit is inactive, not yet started, or expired",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const travelCreditRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listTravelCreditsRoute, async (c) =>
    c.json(await financeService.travelCredits.list(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createTravelCreditRoute, async (c) => {
    try {
      const row = await financeService.travelCredits.create(
        c.get("db"),
        c.req.valid("json"),
        c.get("userId"),
      )
      if (!row) {
        throw new Error("Failed to create travel credit")
      }
      return c.json({ data: row }, 201)
    } catch (error) {
      if (error instanceof TravelCreditServiceError && error.code === "code_in_use") {
        return c.json({ error: "Travel credit code already in use" }, 409)
      }
      throw error
    }
  })
  .openapi(getTravelCreditRoute, async (c) => {
    const row = await financeService.travelCredits.getById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Travel credit not found" }, 404)
  })
  .openapi(updateTravelCreditRoute, async (c) => {
    const row = await financeService.travelCredits.update(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Travel credit not found" }, 404)
  })
  .openapi(redeemTravelCreditRoute, async (c) => {
    try {
      const result = await financeService.travelCredits.redeem(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    } catch (error) {
      if (error instanceof TravelCreditServiceError) {
        const status =
          error.code === "travel_credit_not_found"
            ? 404
            : error.code === "travel_credit_insufficient_balance" ||
                error.code === "idempotency_conflict"
              ? 409
              : 422
        return c.json({ error: error.code }, status)
      }
      throw error
    }
  })

export const financeTravelCreditRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
}).route("/", travelCreditRoutes)
