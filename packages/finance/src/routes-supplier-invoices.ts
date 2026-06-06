import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import { resolveStoredDocumentDownload } from "./document-download.js"
import { getActionLedgerRequestContext, getFinanceRouteRuntime } from "./routes.js"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import {
  SupplierInvoiceServiceError,
  supplierInvoicesService,
} from "./service-supplier-invoices.js"
import {
  insertSupplierInvoiceSchema,
  insertSupplierPaymentSchema,
  setSupplierCostAllocationsSchema,
  setSupplierInvoiceLinesSchema,
  supplierInvoiceListQuerySchema,
  supplierPaymentListQuerySchema,
  updateSupplierInvoiceSchema,
} from "./validation.js"

/**
 * Map a SupplierInvoiceServiceError to HTTP. `not_found` → 404; the allocation
 * invariant violations (§6.1) → 422. Anything else re-throws to the boundary.
 */
function handleSupplierInvoiceError(c: Context<Env>, error: unknown) {
  if (error instanceof SupplierInvoiceServiceError) {
    const status = error.code === "supplier_invoice_not_found" ? 404 : 422
    return c.json({ error: error.message, code: error.code }, status)
  }
  throw error
}

/** Action-ledger runtime for the AP (supplier-invoice) service. */
function apRuntime(c: Context<Env>) {
  return {
    actionLedgerContext: getActionLedgerRequestContext(c),
    actionLedgerAuthorizationSource: "finance.supplier_invoice.route" as const,
  }
}

export const supplierInvoiceRoutes = new Hono<Env>()
  .get("/supplier-invoices", async (c) => {
    const query = parseQuery(c, supplierInvoiceListQuerySchema)
    return c.json(await supplierInvoicesService.list(c.get("db"), query))
  })

  .post("/supplier-invoices", async (c) => {
    try {
      const row = await supplierInvoicesService.create(
        c.get("db"),
        await parseJsonBody(c, insertSupplierInvoiceSchema),
        apRuntime(c),
      )
      return c.json({ data: row }, 201)
    } catch (error) {
      return handleSupplierInvoiceError(c, error)
    }
  })

  .get("/supplier-invoices/:id", async (c) => {
    const row = await supplierInvoicesService.getById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Supplier invoice not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/supplier-invoices/:id", async (c) => {
    const row = await supplierInvoicesService.update(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateSupplierInvoiceSchema),
      apRuntime(c),
    )
    if (!row) return c.json({ error: "Supplier invoice not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/supplier-invoices/:id", async (c) => {
    const result = await supplierInvoicesService.softDelete(
      c.get("db"),
      c.req.param("id"),
      apRuntime(c),
    )
    if (!result) return c.json({ error: "Supplier invoice not found" }, 404)
    return c.json({ data: result })
  })

  .put("/supplier-invoices/:id/lines", async (c) => {
    const row = await supplierInvoicesService.setLines(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, setSupplierInvoiceLinesSchema),
      apRuntime(c),
    )
    if (!row) return c.json({ error: "Supplier invoice not found" }, 404)
    return c.json({ data: row })
  })

  .put("/supplier-invoices/:id/allocations", async (c) => {
    try {
      const row = await supplierInvoicesService.setAllocations(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, setSupplierCostAllocationsSchema),
        apRuntime(c),
      )
      if (!row) return c.json({ error: "Supplier invoice not found" }, 404)
      return c.json({ data: row })
    } catch (error) {
      return handleSupplierInvoiceError(c, error)
    }
  })

  .get("/supplier-invoices/:id/document/download", async (c) => {
    const invoice = await supplierInvoicesService.getById(c.get("db"), c.req.param("id"))
    if (!invoice) return c.json({ error: "Supplier invoice not found" }, 404)
    if (!invoice.storageKey) return c.json({ error: "No document attached" }, 404)

    const runtime = getFinanceRouteRuntime(c)
    const download = await resolveStoredDocumentDownload(
      { storageKey: invoice.storageKey },
      { bindings: c.env, resolveDocumentDownloadUrl: runtime?.resolveDocumentDownloadUrl },
    )
    if (download.status === "resolver_not_configured") {
      return c.json({ error: "Document download resolver is not configured" }, 501)
    }
    if (download.status !== "ready") {
      return c.json({ error: "Supplier invoice document is not available" }, 404)
    }
    return c.redirect(download.download.url, 302)
  })

  .get("/supplier-invoices/:id/payments", async (c) => {
    const query = parseQuery(c, supplierPaymentListQuerySchema)
    return c.json(
      await financeService.listSupplierPayments(c.get("db"), {
        ...query,
        supplierInvoiceId: c.req.param("id"),
      }),
    )
  })

  .post("/supplier-invoices/:id/payments", async (c) => {
    const body = await parseJsonBody(c, insertSupplierPaymentSchema)
    const row = await financeService.createSupplierPayment(
      c.get("db"),
      { ...body, supplierInvoiceId: c.req.param("id") },
      {
        ...getFinanceRouteRuntime(c),
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.supplier_payment.route",
      },
    )
    return c.json({ data: row }, 201)
  })

export type SupplierInvoiceRoutes = typeof supplierInvoiceRoutes
