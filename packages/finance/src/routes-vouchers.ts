/**
 * Admin voucher routes — mounted by the operator starter under
 * `/v1/admin/finance/...`. Covers voucher issuance, lookup, update, and
 * redemption.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9C). Request schemas reuse the existing
 * `@voyant-travel/finance-contracts` schemas the handlers already parse;
 * response schemas come from the shared `routes-payment-schemas.ts` row shapes
 * (authored from the Drizzle `$inferSelect` shapes; §17 dates → strings). The
 * single voucher resource is its own `OpenAPIHono` sub-chain composed onto
 * `financeVoucherRoutes` via `.route("/")` so the `.openapi()` operations
 * propagate up through the parent `financeRoutes` registry.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import { errorResponseSchema } from "./routes-invoice-schemas.js"
import { voucherRedeemResultSchema, voucherSchema } from "./routes-payment-schemas.js"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import { VoucherServiceError } from "./service-vouchers.js"
import {
  insertVoucherSchema,
  redeemVoucherSchema,
  updateVoucherSchema,
  voucherListQuerySchema,
} from "./validation.js"

const idParamSchema = z.object({ id: z.string() })

const listVouchersRoute = createRoute({
  method: "get",
  path: "/vouchers",
  request: { query: voucherListQuerySchema },
  responses: {
    200: {
      description: "List of vouchers",
      content: { "application/json": { schema: listResponseSchema(voucherSchema) } },
    },
  },
})

const createVoucherRoute = createRoute({
  method: "post",
  path: "/vouchers",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertVoucherSchema } },
    },
  },
  responses: {
    201: {
      description: "The issued voucher",
      content: { "application/json": { schema: z.object({ data: voucherSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "The voucher code is already in use",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getVoucherRoute = createRoute({
  method: "get",
  path: "/vouchers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The voucher",
      content: { "application/json": { schema: z.object({ data: voucherSchema }) } },
    },
    404: {
      description: "Voucher not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateVoucherRoute = createRoute({
  method: "patch",
  path: "/vouchers/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateVoucherSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated voucher",
      content: { "application/json": { schema: z.object({ data: voucherSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Voucher not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const redeemVoucherRoute = createRoute({
  method: "post",
  path: "/vouchers/{id}/redeem",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: redeemVoucherSchema } },
    },
  },
  responses: {
    201: {
      description: "The redemption (updated voucher + the recorded redemption row)",
      content: { "application/json": { schema: z.object({ data: voucherRedeemResultSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Voucher not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "The voucher has insufficient remaining balance",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "The voucher is inactive, not yet started, or expired",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const voucherRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listVouchersRoute, async (c) =>
    c.json(await financeService.vouchers.list(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createVoucherRoute, async (c) => {
    try {
      const row = await financeService.vouchers.create(
        c.get("db"),
        c.req.valid("json"),
        c.get("userId"),
      )
      if (!row) {
        throw new Error("Failed to create voucher")
      }
      return c.json({ data: row }, 201)
    } catch (error) {
      if (error instanceof VoucherServiceError && error.code === "code_in_use") {
        return c.json({ error: "Voucher code already in use" }, 409)
      }
      throw error
    }
  })
  .openapi(getVoucherRoute, async (c) => {
    const row = await financeService.vouchers.getById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Voucher not found" }, 404)
  })
  .openapi(updateVoucherRoute, async (c) => {
    const row = await financeService.vouchers.update(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Voucher not found" }, 404)
  })
  .openapi(redeemVoucherRoute, async (c) => {
    try {
      const result = await financeService.vouchers.redeem(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    } catch (error) {
      if (error instanceof VoucherServiceError) {
        const status =
          error.code === "voucher_not_found"
            ? 404
            : error.code === "insufficient_balance"
              ? 409
              : 422
        return c.json({ error: error.code }, status)
      }
      throw error
    }
  })

export const financeVoucherRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
}).route("/", voucherRoutes)
