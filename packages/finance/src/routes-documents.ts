import type { EventBus, ModuleContainer } from "@voyant-travel/core"
import {
  createDrizzlePublicDocumentDeliveryGrantStore,
  createPublicDocumentDeliveryGrant,
  parseOptionalJsonBody,
} from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"

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

      const input = await parseOptionalJsonBody(c, generateInvoiceDocumentInputSchema)
      const result = await financeDocumentsService.generateInvoiceDocument(
        c.get("db"),
        c.req.param("id"),
        input,
        { generator, bindings: c.env, eventBus: runtime.eventBus },
      )

      if (result.status === "not_found") return c.json({ error: "Invoice not found" }, 404)
      if (result.status === "generator_failed") {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }
      if (!("rendition" in result)) {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }

      return c.json({ data: await attachDownloadEnvelope(c, runtime, result, input) }, 201)
    })
    .post("/invoices/:id/regenerate-document", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const generator = runtime.invoiceDocumentGenerator
      if (!generator) {
        return c.json({ error: "Invoice document generator is not configured" }, 501)
      }

      const input = await parseOptionalJsonBody(c, generateInvoiceDocumentInputSchema)
      const result = await financeDocumentsService.regenerateInvoiceDocument(
        c.get("db"),
        c.req.param("id"),
        input,
        { generator, bindings: c.env, eventBus: runtime.eventBus },
      )

      if (result.status === "not_found") return c.json({ error: "Invoice not found" }, 404)
      if (result.status === "generator_failed") {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }
      if (!("rendition" in result)) {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }

      return c.json({ data: await attachDownloadEnvelope(c, runtime, result, input) })
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
  T extends {
    rendition: {
      id?: string | null
      format?: string | null
      storageKey?: string | null
      metadata?: unknown
    }
  },
>(
  c: Context<Env>,
  runtime: FinanceRouteRuntime,
  result: T,
  input: { publicDelivery?: boolean; publicDeliveryTtlSeconds?: number | undefined },
) {
  const download = await resolveStoredDocumentDownload(result.rendition, {
    bindings: c.env,
    resolveDocumentDownloadUrl: runtime.resolveDocumentDownloadUrl,
  })
  const withAdminDownload =
    download.status === "ready" ? { ...result, download: download.download } : result

  if (!input.publicDelivery || !result.rendition.storageKey) {
    return withAdminDownload
  }

  const publicDownload = await createPublicDocumentDeliveryGrant(
    createDrizzlePublicDocumentDeliveryGrantStore(c.get("db")),
    {
      storageKey: result.rendition.storageKey,
      publicBaseUrl: new URL(c.req.url).origin,
      ttlSeconds: input.publicDeliveryTtlSeconds,
      filename: download.status === "ready" ? download.download.filename : null,
      contentType: result.rendition.format === "pdf" ? "application/pdf" : null,
      source: {
        module: "finance",
        entity: "invoice_rendition",
        id: result.rendition.id ?? null,
      },
      createdBy: c.get("userId") ?? null,
      createdByType: c.get("userId") ? "staff" : null,
    },
  )

  return { ...withAdminDownload, publicDownload }
}
