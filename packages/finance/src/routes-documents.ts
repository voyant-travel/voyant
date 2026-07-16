/**
 * Admin finance-document routes — mounted by the operator starter under
 * `/v1/admin/finance/...` (staff-actor-gated by the parent app's middleware
 * chain). Covers invoice-document generation/regeneration (rendering a PDF/HTML
 * rendition through the runtime-injected generator) and the signed
 * invoice-rendition download redirect.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9E). The generate/regenerate routes take a
 * fully-optional JSON body — the original handlers parsed it via
 * `parseOptionalJsonBody`, so per the §3 optional-body convention these declare
 * NO OpenAPI `request.body`; the route `description` documents the accepted
 * optional fields and the handler keeps parsing via `parseOptionalJsonBody`
 * (a missing body is valid and renders with defaults). Response schemas reuse
 * `invoiceRenditionSchema` from `routes-invoice-schemas.ts`; the generate
 * responses additionally carry the optional signed-download envelopes.
 *
 * This is a factory (`createFinanceAdminDocumentRoutes(options)`) because the
 * routes need the runtime-injected generator + download resolver + event bus —
 * it returns an `OpenAPIHono` so the `.openapi()` operations propagate up
 * through the parent admin registry.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { EventBus, ModuleContainer } from "@voyant-travel/core"
import { openApiValidationHook, parseOptionalJsonBody } from "@voyant-travel/hono"
import {
  createDrizzlePublicDocumentDeliveryGrantStore,
  createPublicDocumentDeliveryGrant,
} from "@voyant-travel/public-document-delivery"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { resolveStoredDocumentDownload } from "./document-download.js"
import {
  buildFinanceRouteRuntime,
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRouteRuntime,
} from "./route-runtime.js"
import { invoiceRenditionSchema } from "./routes-invoice-schemas.js"
import { financeService } from "./service.js"
import {
  financeDocumentsService,
  type InvoiceDocumentGenerator,
  type InvoiceDocumentRuntimeOptions,
} from "./service-documents.js"
import { generateInvoiceDocumentInputSchema } from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

export interface FinanceDocumentRouteOptions {
  invoiceDocumentGenerator?: InvoiceDocumentGenerator
  resolveCustomFields?: InvoiceDocumentRuntimeOptions["resolveCustomFields"]
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

const errorResponseSchema = z.object({ error: z.string() })

/** The signed inline download envelope (§17: `expiresAt` is an ISO string). */
const downloadSchema = z.object({
  url: z.string(),
  expiresAt: z.string().nullable(),
  filename: z.string().nullable(),
})

/** The public-delivery grant envelope (adds `grantId` to the download shape). */
const publicDownloadSchema = downloadSchema.extend({ grantId: z.string() })

/**
 * The generate/regenerate response payload — the `GeneratedInvoiceDocumentRecord`
 * (`invoiceId` + rendered body + the rendition row) plus the optional admin
 * `download` (present when the rendition resolved to a ready, downloadable file)
 * and optional `publicDownload` (present when the request asked for a
 * public-delivery grant), as assembled by `attachDownloadEnvelope`.
 */
const generatedDocumentSchema = z.object({
  status: z.literal("generated"),
  invoiceId: z.string(),
  renderedBodyFormat: z.enum(["html", "markdown", "lexical_json"]),
  renderedBody: z.string(),
  rendition: invoiceRenditionSchema,
  download: downloadSchema.optional(),
  publicDownload: publicDownloadSchema.optional(),
})

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

const generateInvoiceDocumentRoute = createRoute({
  method: "post",
  path: "/invoices/{id}/generate-document",
  request: { params: z.object({ id: z.string() }) },
  // Optional body: every field of `generateInvoiceDocumentInputSchema` is
  // optional/defaulted (`templateId`, `language`, `format`, `publicDelivery`,
  // `publicDeliveryTtlSeconds`, …). A missing body renders with defaults, so per
  // §3 there is NO declared `request.body`; the handler parses via
  // `parseOptionalJsonBody`.
  description:
    "Generate the invoice document. Accepts an OPTIONAL JSON body with the rendition " +
    "options (`templateId`, `language`, `format`, `publicDelivery`, " +
    "`publicDeliveryTtlSeconds`); a missing/empty body renders with defaults.",
  responses: {
    201: {
      description: "The generated rendition (with signed download envelopes when available)",
      content: { "application/json": { schema: z.object({ data: generatedDocumentSchema }) } },
    },
    404: {
      description: "Invoice not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "The invoice document generator is not configured",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    502: {
      description: "The invoice document generator failed",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const regenerateInvoiceDocumentRoute = createRoute({
  method: "post",
  path: "/invoices/{id}/regenerate-document",
  request: { params: z.object({ id: z.string() }) },
  description:
    "Regenerate the invoice document. Accepts an OPTIONAL JSON body with the rendition " +
    "options (`templateId`, `language`, `format`, `publicDelivery`, " +
    "`publicDeliveryTtlSeconds`); a missing/empty body regenerates with defaults.",
  responses: {
    200: {
      description: "The regenerated rendition (with signed download envelopes when available)",
      content: { "application/json": { schema: z.object({ data: generatedDocumentSchema }) } },
    },
    404: {
      description: "Invoice not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "The invoice document generator is not configured",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    502: {
      description: "The invoice document generator failed",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const downloadInvoiceRenditionRoute = createRoute({
  method: "get",
  path: "/invoice-renditions/{id}/download",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    302: { description: "Redirect to the signed rendition download URL" },
    404: {
      description: "Invoice rendition not found, or its file is not available",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "The document download resolver is not configured",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export function createFinanceAdminDocumentRoutes(options: FinanceDocumentRouteOptions = {}) {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(generateInvoiceDocumentRoute, async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const generator = runtime.invoiceDocumentGenerator
      if (!generator) {
        return c.json({ error: "Invoice document generator is not configured" }, 501)
      }

      const input = await parseOptionalJsonBody(c, generateInvoiceDocumentInputSchema)
      const result = await financeDocumentsService.generateInvoiceDocument(
        c.get("db"),
        c.req.valid("param").id,
        input,
        {
          generator,
          bindings: c.env,
          eventBus: runtime.eventBus,
          resolveCustomFields: runtime.resolveCustomFields,
        },
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
    .openapi(regenerateInvoiceDocumentRoute, async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const generator = runtime.invoiceDocumentGenerator
      if (!generator) {
        return c.json({ error: "Invoice document generator is not configured" }, 501)
      }

      const input = await parseOptionalJsonBody(c, generateInvoiceDocumentInputSchema)
      const result = await financeDocumentsService.regenerateInvoiceDocument(
        c.get("db"),
        c.req.valid("param").id,
        input,
        {
          generator,
          bindings: c.env,
          eventBus: runtime.eventBus,
          resolveCustomFields: runtime.resolveCustomFields,
        },
      )

      if (result.status === "not_found") return c.json({ error: "Invoice not found" }, 404)
      if (result.status === "generator_failed") {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }
      if (!("rendition" in result)) {
        return c.json({ error: "Invoice document generation failed" }, 502)
      }

      return c.json({ data: await attachDownloadEnvelope(c, runtime, result, input) }, 200)
    })
    .openapi(downloadInvoiceRenditionRoute, async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const rendition = await financeService.getInvoiceRenditionById(
        c.get("db"),
        c.req.valid("param").id,
      )
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
