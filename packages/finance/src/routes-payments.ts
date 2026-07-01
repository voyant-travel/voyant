/**
 * Admin payment routes — mounted by the operator starter under
 * `/v1/admin/finance/...`. Covers the unified payments view (customer +
 * supplier, dispatched by typeid prefix) and the supplier-payment collection.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9C). Request schemas reuse the existing
 * `@voyant-travel/finance-contracts` schemas the handlers already parse;
 * response schemas come from the shared `routes-payment-schemas.ts` row shapes
 * (authored from the Drizzle `$inferSelect` / `UnifiedPaymentRow` shapes; §17
 * dates → strings). Each resource is its own small `OpenAPIHono` sub-chain
 * composed onto `financePaymentRoutes` via `.route("/")` so the `.openapi()`
 * operations propagate up through the parent `financeRoutes` registry while
 * keeping type-inference cost bounded.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import { errorResponseSchema, paymentSchema } from "./routes-invoice-schemas.js"
import { supplierPaymentSchema, unifiedPaymentSchema } from "./routes-payment-schemas.js"
import { getActionLedgerRequestContext, getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService, PaymentValidationError } from "./service.js"
import {
  insertSupplierPaymentSchema,
  paymentListQuerySchema,
  supplierPaymentListQuerySchema,
  updatePaymentSchema,
  updateSupplierPaymentSchema,
} from "./validation.js"

const idParamSchema = z.object({ id: z.string() })

// --- unified payments (customer + supplier) -------------------------------

const listAllPaymentsRoute = createRoute({
  method: "get",
  path: "/payments",
  request: { query: paymentListQuerySchema },
  responses: {
    200: {
      description: "Unified list of customer + supplier payments",
      content: { "application/json": { schema: listResponseSchema(unifiedPaymentSchema) } },
    },
  },
})

const getPaymentRoute = createRoute({
  method: "get",
  path: "/payments/{id}",
  description:
    "Look up a single payment by id. Dispatches by typeid prefix: `spay_*` → " +
    "supplier payment, `pay_*` → customer payment.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The payment (customer or supplier)",
      content: { "application/json": { schema: z.object({ data: unifiedPaymentSchema }) } },
    },
    404: {
      description: "Payment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePaymentRoute = createRoute({
  method: "patch",
  path: "/payments/{id}",
  description:
    "Update a customer payment. Recomputes the invoice's paid/balance/status " +
    "from the remaining completed payments. Supplier payments (`spay_*` id) " +
    "must be updated via `/supplier-payments/{id}` and return 400 here.",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePaymentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated customer payment",
      content: { "application/json": { schema: z.object({ data: paymentSchema }) } },
    },
    400: {
      description: "invalid_request, or a supplier payment id was supplied",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Payment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "The payment conflicts with the invoice state (e.g. overpayment)",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePaymentRoute = createRoute({
  method: "delete",
  path: "/payments/{id}",
  description:
    "Remove a customer payment, recomputing invoice totals the same way PATCH " +
    "does. Supplier payments (`spay_*` id) must be deleted via " +
    "`/supplier-payments/{id}` and return 400 here.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The deleted customer payment",
      content: { "application/json": { schema: z.object({ data: paymentSchema }) } },
    },
    400: {
      description: "A supplier payment id was supplied",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Payment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const unifiedPaymentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listAllPaymentsRoute, async (c) =>
    c.json(await financeService.listAllPayments(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getPaymentRoute, async (c) => {
    const row = await financeService.getPaymentById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment not found" }, 404)
  })
  .openapi(updatePaymentRoute, async (c) => {
    const id = c.req.valid("param").id
    if (id.startsWith("spay_")) {
      return c.json({ error: "Use /supplier-payments/:id to update supplier payments" }, 400)
    }
    const runtime = getFinanceRouteRuntime(c)
    try {
      const row = await financeService.updatePayment(c.get("db"), id, c.req.valid("json"), {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment.route",
      })
      return row ? c.json({ data: row }, 200) : c.json({ error: "Payment not found" }, 404)
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        if (error.status === 409) {
          return c.json({ error: error.message, code: error.code, details: error.details }, 409)
        }
        return c.json({ error: error.message, code: error.code, details: error.details }, 400)
      }
      throw error
    }
  })
  .openapi(deletePaymentRoute, async (c) => {
    const id = c.req.valid("param").id
    if (id.startsWith("spay_")) {
      return c.json({ error: "Use /supplier-payments/:id to delete supplier payments" }, 400)
    }
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePayment(c.get("db"), id, {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment.route",
    })
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment not found" }, 404)
  })

// --- supplier payments ----------------------------------------------------

const listSupplierPaymentsRoute = createRoute({
  method: "get",
  path: "/supplier-payments",
  request: { query: supplierPaymentListQuerySchema },
  responses: {
    200: {
      description: "List of supplier payments",
      content: { "application/json": { schema: listResponseSchema(supplierPaymentSchema) } },
    },
  },
})

const createSupplierPaymentRoute = createRoute({
  method: "post",
  path: "/supplier-payments",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertSupplierPaymentSchema } },
    },
  },
  responses: {
    201: {
      description: "The recorded supplier payment",
      content: { "application/json": { schema: z.object({ data: supplierPaymentSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateSupplierPaymentRoute = createRoute({
  method: "patch",
  path: "/supplier-payments/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateSupplierPaymentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated supplier payment",
      content: { "application/json": { schema: z.object({ data: supplierPaymentSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Supplier payment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const supplierPaymentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listSupplierPaymentsRoute, async (c) =>
    c.json(await financeService.listSupplierPayments(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createSupplierPaymentRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createSupplierPayment(c.get("db"), c.req.valid("json"), {
      ...(runtime ?? {}),
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.supplier_payment.route",
    })
    if (!row) {
      throw new Error("Failed to create supplier payment")
    }
    return c.json({ data: row }, 201)
  })
  .openapi(updateSupplierPaymentRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updateSupplierPayment(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      {
        ...(runtime ?? {}),
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.supplier_payment.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Supplier payment not found" }, 404)
  })

export const financePaymentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", unifiedPaymentRoutes)
  .route("/", supplierPaymentRoutes)
