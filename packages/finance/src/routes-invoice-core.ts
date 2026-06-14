import { parseJsonBody, parseOptionalJsonBody, requireUserId } from "@voyant-travel/hono"
import { Hono } from "hono"
import { getActionLedgerRequestContext, getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService, PaymentValidationError } from "./service.js"
import {
  createPaymentSessionFromInvoiceSchema,
  insertCreditNoteLineItemSchema,
  insertCreditNoteSchema,
  insertFinanceNoteSchema,
  insertInvoiceLineItemSchema,
  insertPaymentSchema,
  updateCreditNoteSchema,
  updateInvoiceLineItemSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
} from "./validation.js"

export const financeInvoiceCoreRoutes = new Hono<Env>()

  // GET /invoices/:id — Get single invoice  // GET /invoices/:id — Get single invoice
  .get("/invoices/:id", async (c) => {
    const row = await financeService.getInvoiceById(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row })
  })

  // PATCH /invoices/:id — Update invoice
  .patch("/invoices/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updateInvoice(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateInvoiceSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.invoice.route",
      },
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /invoices/:id — Delete invoice (draft only)
  .delete("/invoices/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const result = await financeService.deleteInvoice(c.get("db"), c.req.param("id"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.invoice.route",
    })

    if (result.status === "not_found") {
      return c.json({ error: "Invoice not found" }, 404)
    }

    if (result.status === "not_draft") {
      return c.json({ error: "Only draft invoices can be deleted" }, 400)
    }

    return c.json({ success: true }, 200)
  })

  // POST /invoices/:id/void — Void an issued invoice without deleting audit history.
  .post("/invoices/:id/void", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const result = await financeService.voidInvoice(
      c.get("db"),
      c.req.param("id"),
      await parseOptionalJsonBody(c, voidInvoiceSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.invoice.route",
      },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Invoice not found" }, 404)
    }
    if (result.status === "already_void") {
      return c.json({ error: "Invoice is already void" }, 409)
    }
    if (result.status === "draft") {
      return c.json({ error: "Draft invoices can be deleted instead" }, 400)
    }
    if (result.status === "invalid_status") {
      return c.json({ error: "Invoice cannot be voided from its current status" }, 409)
    }
    if (result.status === "has_payments") {
      return c.json({ error: "Invoices with payments cannot be voided" }, 409)
    }
    if (result.status === "has_credit_notes") {
      return c.json({ error: "Invoices with credit notes cannot be voided" }, 409)
    }

    return c.json({ data: result.invoice }, 200)
  })

  .post("/invoices/:id/payment-session", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.createPaymentSessionFromInvoice(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, createPaymentSessionFromInvoiceSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.payment_session.route",
        },
      )

      if (!row) {
        return c.json({ error: "Invoice not found" }, 404)
      }

      return c.json({ data: row }, 201)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create payment session"
      return c.json({ error: message }, 409)
    }
  })

  // ========================================================================
  // Invoice Line Items
  // ========================================================================

  // GET /invoices/:id/line-items — List line items
  .get("/invoices/:id/line-items", async (c) => {
    return c.json({
      data: await financeService.listInvoiceLineItems(c.get("db"), c.req.param("id")),
    })
  })

  // POST /invoices/:id/line-items — Add line item
  .post("/invoices/:id/line-items", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createInvoiceLineItem(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertInvoiceLineItemSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.invoice_line_item.route",
      },
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /invoices/:id/line-items/:lineId — Update line item
  .patch("/invoices/:id/line-items/:lineId", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updateInvoiceLineItem(
      c.get("db"),
      c.req.param("lineId"),
      await parseJsonBody(c, updateInvoiceLineItemSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.invoice_line_item.route",
      },
    )

    if (!row) {
      return c.json({ error: "Line item not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /invoices/:id/line-items/:lineId — Delete line item
  .delete("/invoices/:id/line-items/:lineId", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deleteInvoiceLineItem(c.get("db"), c.req.param("lineId"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.invoice_line_item.route",
    })

    if (!row) {
      return c.json({ error: "Line item not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ========================================================================
  // Payments
  // ========================================================================

  // GET /invoices/:id/payments — List payments
  .get("/invoices/:id/payments", async (c) => {
    return c.json({ data: await financeService.listPayments(c.get("db"), c.req.param("id")) })
  })

  // POST /invoices/:id/payments — Record payment (transaction)
  .post("/invoices/:id/payments", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.createPayment(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, insertPaymentSchema),
        {
          ...(runtime ?? {}),
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.payment.route",
        },
      )

      if (!row) {
        return c.json({ error: "Invoice not found" }, 404)
      }

      return c.json({ data: row }, 201)
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        return c.json(
          { error: error.message, code: error.code, details: error.details },
          error.status,
        )
      }

      throw error
    }
  })

  // ========================================================================
  // Credit Notes
  // ========================================================================

  // GET /invoices/:id/credit-notes — List credit notes
  .get("/invoices/:id/credit-notes", async (c) => {
    return c.json({
      data: await financeService.listCreditNotes(c.get("db"), c.req.param("id")),
    })
  })

  // POST /invoices/:id/credit-notes — Create credit note
  .post("/invoices/:id/credit-notes", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createCreditNote(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertCreditNoteSchema),
      {
        ...(runtime ?? {}),
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.credit_note.route",
      },
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /invoices/:id/credit-notes/:creditNoteId — Update credit note
  .patch("/invoices/:id/credit-notes/:creditNoteId", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updateCreditNote(
      c.get("db"),
      c.req.param("creditNoteId"),
      await parseJsonBody(c, updateCreditNoteSchema),
      {
        ...(runtime ?? {}),
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.credit_note.route",
      },
    )

    if (!row) {
      return c.json({ error: "Credit note not found" }, 404)
    }

    return c.json({ data: row })
  })

  // ========================================================================
  // Credit Note Line Items
  // ========================================================================

  // GET /invoices/:id/credit-notes/:creditNoteId/line-items — List credit note line items
  .get("/invoices/:id/credit-notes/:creditNoteId/line-items", async (c) => {
    return c.json({
      data: await financeService.listCreditNoteLineItems(c.get("db"), c.req.param("creditNoteId")),
    })
  })

  // POST /invoices/:id/credit-notes/:creditNoteId/line-items — Add credit note line item
  .post("/invoices/:id/credit-notes/:creditNoteId/line-items", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createCreditNoteLineItem(
      c.get("db"),
      c.req.param("creditNoteId"),
      await parseJsonBody(c, insertCreditNoteLineItemSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.credit_note_line_item.route",
      },
    )

    if (!row) {
      return c.json({ error: "Credit note not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ========================================================================
  // Finance Notes
  // ========================================================================

  // GET /invoices/:id/notes — List notes
  .get("/invoices/:id/notes", async (c) => {
    return c.json({ data: await financeService.listNotes(c.get("db"), c.req.param("id")) })
  })

  // POST /invoices/:id/notes — Add note
  .post("/invoices/:id/notes", async (c) => {
    const userId = requireUserId(c)

    const row = await financeService.createNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertFinanceNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })
