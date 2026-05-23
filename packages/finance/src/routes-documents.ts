import type { EventBus, ModuleContainer } from "@voyantjs/core"
import { parseOptionalJsonBody } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { resolveStoredDocumentDownload } from "./document-download.js"
import {
  buildFinanceRouteRuntime,
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRouteRuntime,
} from "./route-runtime.js"
import { financeService } from "./service.js"
import { financeDocumentsService } from "./service-documents.js"
import { generateInvoiceDocumentInputSchema } from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

export type InvoiceDocumentGenerator = Parameters<
  typeof financeDocumentsService.generateInvoiceDocument
>[3]["generator"]

export interface FinanceDocumentRouteOptions {
  invoiceDocumentGenerator?: InvoiceDocumentGenerator
  resolveInvoiceDocumentGenerator?: (
    bindings: Record<string, unknown>,
  ) => InvoiceDocumentGenerator | undefined
  resolveDocumentDownloadUrl?: (
    bindings: unknown,
    storageKey: string,
  ) => Promise<string | null> | string | null
  eventBus?: EventBus
  resolveEventBus?: (bindings: Record<string, unknown>) => EventBus | undefined
}

function getRuntime(
  options: FinanceDocumentRouteOptions | undefined,
  bindings: Record<string, unknown>,
  resolveFromContainer?: (key: string) => FinanceRouteRuntime | undefined,
) {
  return (
    resolveFromContainer?.(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY) ??
    buildFinanceRouteRuntime(bindings, options)
  )
}

export function createFinanceAdminDocumentRoutes(options: FinanceDocumentRouteOptions = {}) {
  return new Hono<Env>()
    .post("/invoices/:id/generate-document", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const generator = runtime.invoiceDocumentGenerator
      if (!generator) {
        return c.json({ error: "Invoice document generator is not configured" }, 501)
      }

      const result = await financeDocumentsService.generateInvoiceDocument(
        c.get("db"),
        c.req.param("id"),
        await parseOptionalJsonBody(c, generateInvoiceDocumentInputSchema),
        { generator, bindings: c.env, eventBus: runtime.eventBus },
      )

      if (result.status === "not_found") return c.json({ error: "Invoice not found" }, 404)
      if (result.status === "generator_failed") {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }
      if (!("rendition" in result)) {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }

      return c.json({ data: await attachDownloadEnvelope(c.env, runtime, result) }, 201)
    })
    .post("/invoices/:id/regenerate-document", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const generator = runtime.invoiceDocumentGenerator
      if (!generator) {
        return c.json({ error: "Invoice document generator is not configured" }, 501)
      }

      const result = await financeDocumentsService.regenerateInvoiceDocument(
        c.get("db"),
        c.req.param("id"),
        await parseOptionalJsonBody(c, generateInvoiceDocumentInputSchema),
        { generator, bindings: c.env, eventBus: runtime.eventBus },
      )

      if (result.status === "not_found") return c.json({ error: "Invoice not found" }, 404)
      if (result.status === "generator_failed") {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }
      if (!("rendition" in result)) {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }

      return c.json({ data: await attachDownloadEnvelope(c.env, runtime, result) })
    })
    .get("/invoice-renditions/:id/download", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const rendition = await financeService.getInvoiceRenditionById(c.get("db"), c.req.param("id"))
      if (!rendition) {
        return c.json({ error: "Invoice rendition not found" }, 404)
      }

      const download = await resolveStoredDocumentDownload(rendition, {
        bindings: c.env,
        resolveDocumentDownloadUrl: runtime.resolveDocumentDownloadUrl,
      })
      if (download.status === "resolver_not_configured") {
        return c.json({ error: "Document download resolver is not configured" }, 501)
      }
      if (download.status !== "ready") {
        return c.json({ error: "Invoice document is not available" }, 404)
      }

      return c.redirect(download.download.url, 302)
    })
}

async function attachDownloadEnvelope<
  T extends { rendition: { storageKey?: string | null; metadata?: unknown } },
>(bindings: Record<string, unknown>, runtime: FinanceRouteRuntime, result: T) {
  const download = await resolveStoredDocumentDownload(result.rendition, {
    bindings,
    resolveDocumentDownloadUrl: runtime.resolveDocumentDownloadUrl,
  })
  return download.status === "ready" ? { ...result, download: download.download } : result
}
