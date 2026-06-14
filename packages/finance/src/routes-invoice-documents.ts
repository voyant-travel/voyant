import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import { buildInlineDownload, resolveWaitRequest } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import { waitForInvoiceRendition, waitFormatForMode } from "./service-rendition-wait.js"
import {
  insertInvoiceAttachmentSchema,
  insertInvoiceExternalRefSchema,
  invoiceDocumentWaitQuerySchema,
  renderInvoiceInputSchema,
  updateInvoiceAttachmentSchema,
} from "./validation.js"

export const financeInvoiceDocumentRoutes = new Hono<Env>()

  // ========================================================================
  // Invoice Renditions & External Refs (nested under invoice)
  // ========================================================================

  .get("/invoices/:id/renditions", async (c) => {
    const rows = await financeService.listInvoiceRenditions(c.get("db"), c.req.param("id"))
    return c.json({ data: rows })
  })

  .get("/invoices/:id/attachments", async (c) => {
    const rows = await financeService.listInvoiceAttachments(c.get("db"), c.req.param("id"))
    return c.json({ data: rows })
  })

  .post("/invoices/:id/attachments", async (c) => {
    const row = await financeService.createInvoiceAttachment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertInvoiceAttachmentSchema),
    )
    if (!row) return c.json({ error: "Invoice not found" }, 404)
    return c.json({ data: row }, 201)
  })

  .patch("/invoices/:id/attachments/:attachmentId", async (c) => {
    const row = await financeService.updateInvoiceAttachment(
      c.get("db"),
      c.req.param("id"),
      c.req.param("attachmentId"),
      await parseJsonBody(c, updateInvoiceAttachmentSchema),
    )
    if (!row) return c.json({ error: "Attachment not found" }, 404)
    return c.json({ data: row })
  })

  .get("/invoice-attachments/:id/download", async (c) => {
    const attachment = await financeService.getInvoiceAttachmentById(c.get("db"), c.req.param("id"))
    if (!attachment) return c.json({ error: "Attachment not found" }, 404)

    const download = await buildInlineDownload(c, attachment)
    if (download.status === "resolver_not_configured") {
      return c.json({ error: "Document download resolver is not configured" }, 501)
    }
    if (download.status !== "ready") {
      return c.json({ error: "Attachment file is not available" }, 404)
    }

    return c.redirect(download.download.url, 302)
  })

  .delete("/invoices/:id/attachments/:attachmentId", async (c) => {
    const row = await financeService.deleteInvoiceAttachment(
      c.get("db"),
      c.req.param("id"),
      c.req.param("attachmentId"),
    )
    if (!row) return c.json({ error: "Attachment not found" }, 404)
    return c.json({ success: true })
  })

  .post("/invoices/:id/render", async (c) => {
    const input = await parseJsonBody(c, renderInvoiceInputSchema)
    const waitRequest = resolveWaitRequest(input, parseQuery(c, invoiceDocumentWaitQuerySchema))
    const result = await financeService.renderInvoice(c.get("db"), c.req.param("id"), input)
    if (result.status === "not_found") return c.json({ error: "Invoice not found" }, 404)
    if (waitRequest.mode !== "none" && result.rendition) {
      const waitResult = await waitForInvoiceRendition(c.get("db"), c.req.param("id"), {
        renditionId: result.rendition.id,
        format: waitFormatForMode(waitRequest.mode),
        timeoutMs: waitRequest.timeoutMs,
      })
      const payload = {
        rendition: waitResult.rendition ?? result.rendition,
      }
      if (waitResult.status !== "ready") {
        return c.json({ data: payload }, 202)
      }

      const download = await buildInlineDownload(c, waitResult.rendition)
      if (download.status !== "ready") {
        return c.json({ data: payload }, 202)
      }

      return c.json({ data: { ...payload, download: download.download } }, 201)
    }
    return c.json({ data: result.rendition }, 201)
  })

  .get("/invoices/:id/external-refs", async (c) => {
    const rows = await financeService.listInvoiceExternalRefs(c.get("db"), c.req.param("id"))
    return c.json({ data: rows })
  })

  .post("/invoices/:id/external-refs", async (c) => {
    const row = await financeService.registerInvoiceExternalRef(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertInvoiceExternalRefSchema),
    )
    if (!row) return c.json({ error: "Invoice not found" }, 404)
    return c.json({ data: row }, 201)
  })

  .delete("/invoices/:id/external-refs/:refId", async (c) => {
    const row = await financeService.deleteInvoiceExternalRef(c.get("db"), c.req.param("refId"))
    if (!row) return c.json({ error: "External ref not found" }, 404)
    return c.json({ success: true })
  })
