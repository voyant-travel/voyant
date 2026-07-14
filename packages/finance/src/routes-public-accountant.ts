import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { zipSync } from "fflate"

import { resolveStoredDocumentDownload } from "./document-download.js"
import { getFinanceRouteRuntime } from "./routes-runtime.js"
import { type Env, notFound } from "./routes-shared.js"
import { financeService } from "./service.js"
import { accountantSharesService, buildAccountantInvoicesCsv } from "./service-accountant-shares.js"
import {
  buildDepartureProfitabilityCsv,
  buildProductProfitabilityCsv,
} from "./service-profitability.js"

export interface PublicAccountantRouteOptions {
  resolveDocumentDownloadUrl?: (
    bindings: unknown,
    storageKey: string,
  ) => Promise<string | null> | string | null
}

const errorResponseSchema = z.object({ error: z.string() })
const accountantTokenParamsSchema = z.object({ token: z.string() })
const accountantScopeSchema = z.object({
  from: z.string().nullish(),
  to: z.string().nullish(),
})

const accountantSummaryRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/accountant/{token}/summary",
  request: { params: accountantTokenParamsSchema },
  responses: {
    200: {
      description: "Accountant share profitability summary (scope + departure/product rollups)",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              scope: accountantScopeSchema,
              departures: z.unknown(),
              products: z.unknown(),
            }),
          }),
        },
      },
    },
    404: {
      description: "Share not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    410: {
      description: "Share expired or revoked",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const accountantInvoicesRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/accountant/{token}/invoices",
  request: { params: accountantTokenParamsSchema },
  responses: {
    200: {
      description: "Invoices (with attachments) visible to an accountant share",
      content: { "application/json": { schema: z.object({ data: z.array(z.unknown()) }) } },
    },
    404: {
      description: "Share not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    410: {
      description: "Share expired or revoked",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export function createPublicAccountantRoutes(options: PublicAccountantRouteOptions = {}) {
  const resolveDocumentDownloadUrl = (bindings: unknown, storageKey: string) =>
    options.resolveDocumentDownloadUrl?.(bindings, storageKey) ?? null

  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(accountantSummaryRoute, async (c) => {
      const resolution = await accountantSharesService.resolve(
        c.get("db"),
        c.req.valid("param").token,
      )
      if (resolution.status === "not_found") return notFound(c, "Share not found")
      if (resolution.status === "gone") return c.json({ error: "Share expired or revoked" }, 410)
      const { scope, grantId } = resolution
      await accountantSharesService.recordAccess(c.get("db"), grantId, {
        ip: getClientIp(c.req.raw.headers),
        userAgent: c.req.header("user-agent") ?? null,
      })
      const query = {
        from: scope.from ?? undefined,
        to: scope.to ?? undefined,
      }
      const fx = getFinanceRouteRuntime(c)
      const [departures, products] = await Promise.all([
        financeService.getDepartureProfitability(c.get("db"), query, fx),
        financeService.getProductProfitability(c.get("db"), query, fx),
      ])
      return c.json({ data: { scope, departures, products } }, 200)
    })
    .openapi(accountantInvoicesRoute, async (c) => {
      const resolution = await accountantSharesService.resolve(
        c.get("db"),
        c.req.valid("param").token,
      )
      if (resolution.status === "not_found") return notFound(c, "Share not found")
      if (resolution.status === "gone") return c.json({ error: "Share expired or revoked" }, 410)
      const invoices = await accountantSharesService.getInvoicesWithAttachments(
        c.get("db"),
        resolution.scope,
      )
      return c.json({ data: invoices }, 200)
    })
    .get("/accountant/:token/invoices/:invoiceId/attachments/:attachmentId/download", async (c) => {
      const resolution = await accountantSharesService.resolve(c.get("db"), c.req.param("token"))
      if (resolution.status === "not_found") return notFound(c, "Share not found")
      if (resolution.status === "gone") return c.json({ error: "Share expired or revoked" }, 410)
      const kind = c.req.query("kind") === "supplier" ? "supplier" : "client"
      const attachment = await accountantSharesService.getAttachmentForDownload(
        c.get("db"),
        resolution.scope,
        kind,
        c.req.param("invoiceId"),
        c.req.param("attachmentId"),
      )
      if (!attachment) return notFound(c, "Attachment not found")
      const download = await resolveStoredDocumentDownload(
        { storageKey: attachment.storageKey },
        { bindings: c.env, resolveDocumentDownloadUrl },
      )
      if (download.status !== "ready") return notFound(c, "Attachment file is not available")
      return c.redirect(download.download.url, 302)
    })
    .get("/accountant/:token/invoices/download-all", async (c) => {
      const resolution = await accountantSharesService.resolve(c.get("db"), c.req.param("token"))
      if (resolution.status === "not_found") return notFound(c, "Share not found")
      if (resolution.status === "gone") return c.json({ error: "Share expired or revoked" }, 410)
      const attachments = await accountantSharesService.listAttachmentsForZip(
        c.get("db"),
        resolution.scope,
      )
      if (attachments.length === 0) return notFound(c, "No invoice documents to download")

      const files: Record<string, Uint8Array> = {}
      const used = new Set<string>()
      for (const attachment of attachments) {
        const download = await resolveStoredDocumentDownload(
          { storageKey: attachment.storageKey },
          { bindings: c.env, resolveDocumentDownloadUrl },
        )
        if (download.status !== "ready") continue
        const response = await fetch(download.download.url)
        if (!response.ok) continue
        const bytes = new Uint8Array(await response.arrayBuffer())
        let path = `${attachment.kind}/${sanitizeZipName(attachment.invoiceNumber)}-${sanitizeZipName(attachment.name)}`
        let suffix = 1
        while (used.has(path)) {
          path = `${attachment.kind}/${sanitizeZipName(attachment.invoiceNumber)}-${suffix}-${sanitizeZipName(attachment.name)}`
          suffix += 1
        }
        used.add(path)
        files[path] = bytes
      }
      if (Object.keys(files).length === 0) {
        return notFound(c, "No invoice documents are available")
      }
      return new Response(zipSync(files), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="invoices.zip"',
        },
      })
    })
    .get("/accountant/:token/export/:report", async (c) => {
      const resolution = await accountantSharesService.resolve(c.get("db"), c.req.param("token"))
      if (resolution.status === "not_found") return notFound(c, "Share not found")
      if (resolution.status === "gone") return c.json({ error: "Share expired or revoked" }, 410)
      const query = {
        from: resolution.scope.from ?? undefined,
        to: resolution.scope.to ?? undefined,
      }
      const fx = getFinanceRouteRuntime(c)
      switch (c.req.param("report")) {
        case "departures":
          return csvResponse(
            buildDepartureProfitabilityCsv(
              await financeService.getDepartureProfitability(c.get("db"), query, fx),
            ),
            "departure-profitability.csv",
          )
        case "products":
          return csvResponse(
            buildProductProfitabilityCsv(
              await financeService.getProductProfitability(c.get("db"), query, fx),
            ),
            "product-profitability.csv",
          )
        case "invoices":
          return csvResponse(
            buildAccountantInvoicesCsv(
              await accountantSharesService.getInvoicesWithAttachments(
                c.get("db"),
                resolution.scope,
              ),
            ),
            "invoices.csv",
          )
        default:
          return notFound(c, "Unknown report")
      }
    })
}

function getClientIp(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  )
}

function sanitizeZipName(value: string): string {
  return (value || "file")
    .replace(/[/\\\r\n"]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
