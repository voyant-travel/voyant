import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import { getActionLedgerRequestContext, getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import {
  insertSupplierPaymentSchema,
  paymentListQuerySchema,
  supplierPaymentListQuerySchema,
  updatePaymentSchema,
  updateSupplierPaymentSchema,
} from "./validation.js"

export const financePaymentRoutes = new Hono<Env>()

  // ========================================================================
  // Unified Payments (customer + supplier)
  // ========================================================================

  // GET /payments — List customer + supplier payments
  .get("/payments", async (c) => {
    const query = parseQuery(c, paymentListQuerySchema)
    return c.json(await financeService.listAllPayments(c.get("db"), query))
  })

  // GET /payments/:id — Look up a single payment (customer or supplier)
  // Dispatches by typeid prefix: spay_* → supplier, pay_* → customer.
  .get("/payments/:id", async (c) => {
    const row = await financeService.getPaymentById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Payment not found" }, 404)
    }
    return c.json({ data: row })
  })

  // PATCH /payments/:id — Update a customer payment.
  // Recomputes invoice paidCents/balanceDueCents/status from the
  // remaining completed payments after the change.
  .patch("/payments/:id", async (c) => {
    const id = c.req.param("id")
    if (id.startsWith("spay_")) {
      return c.json({ error: "Use /supplier-payments/:id to update supplier payments" }, 400)
    }
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePayment(
      c.get("db"),
      id,
      await parseJsonBody(c, updatePaymentSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment.route",
      },
    )
    if (!row) {
      return c.json({ error: "Payment not found" }, 404)
    }
    return c.json({ data: row })
  })

  // DELETE /payments/:id — Remove a customer payment.
  // Recomputes invoice totals the same way PATCH does, so an
  // accidentally-recorded payment can be reverted without going
  // through a credit note.
  .delete("/payments/:id", async (c) => {
    const id = c.req.param("id")
    if (id.startsWith("spay_")) {
      return c.json({ error: "Use /supplier-payments/:id to delete supplier payments" }, 400)
    }
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePayment(c.get("db"), id, {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment.route",
    })
    if (!row) {
      return c.json({ error: "Payment not found" }, 404)
    }
    return c.json({ data: row })
  })

  // ========================================================================
  // Supplier Payments
  // ========================================================================

  // GET /supplier-payments — List supplier payments
  .get("/supplier-payments", async (c) => {
    const query = parseQuery(c, supplierPaymentListQuerySchema)
    return c.json(await financeService.listSupplierPayments(c.get("db"), query))
  })

  // POST /supplier-payments — Record supplier payment
  .post("/supplier-payments", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    return c.json(
      {
        data: await financeService.createSupplierPayment(
          c.get("db"),
          await parseJsonBody(c, insertSupplierPaymentSchema),
          {
            ...(runtime ?? {}),
            actionLedgerContext: getActionLedgerRequestContext(c),
            actionLedgerAuthorizationSource: "finance.supplier_payment.route",
          },
        ),
      },
      201,
    )
  })

  // PATCH /supplier-payments/:id — Update supplier payment
  .patch("/supplier-payments/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updateSupplierPayment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateSupplierPaymentSchema),
      {
        ...(runtime ?? {}),
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.supplier_payment.route",
      },
    )

    if (!row) {
      return c.json({ error: "Supplier payment not found" }, 404)
    }

    return c.json({ data: row })
  })
