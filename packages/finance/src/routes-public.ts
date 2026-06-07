import {
  type CheckoutCapabilityAction,
  requireCheckoutCapability,
} from "@voyantjs/bookings/checkout-capability"
import { idempotencyKey, parseJsonBody, parseQuery, UnauthorizedApiError } from "@voyantjs/hono"
import { zipSync } from "fflate"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"

import { resolveStoredDocumentDownload } from "./document-download.js"
import { type Env, getRuntimeEnv, notFound } from "./routes-shared.js"
import { financeService } from "./service.js"
import { accountantSharesService, buildAccountantInvoicesCsv } from "./service-accountant-shares.js"
import {
  buildDepartureProfitabilityCsv,
  buildProductProfitabilityCsv,
} from "./service-profitability.js"
import { publicFinanceService } from "./service-public.js"
import {
  publicFinanceDocumentLookupQuerySchema,
  publicPaymentOptionsQuerySchema,
  publicStartPaymentSessionSchema,
  publicValidateVoucherSchema,
} from "./validation-public.js"

export interface PublicFinanceRouteOptions {
  resolveDocumentDownloadUrl?: (
    bindings: unknown,
    storageKey: string,
  ) => Promise<string | null> | string | null
}

function paymentConflictError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Unable to start payment session"
}

async function requireBookingCheckoutCapability(
  c: Context,
  bookingId: string,
  action: CheckoutCapabilityAction,
) {
  await requireCheckoutCapability(c, bookingId, action, getRuntimeEnv(c))
}

function bookingCheckoutCapability(action: CheckoutCapabilityAction): MiddlewareHandler<Env> {
  return async (c, next) => {
    const bookingId = c.req.param("bookingId")
    if (!bookingId) {
      throw new UnauthorizedApiError("Missing checkout booking id")
    }

    await requireBookingCheckoutCapability(c, bookingId, action)
    await next()
  }
}

function invoiceCheckoutCapability(action: CheckoutCapabilityAction): MiddlewareHandler<Env> {
  return async (c, next) => {
    const invoiceId = c.req.param("invoiceId")
    if (!invoiceId) {
      throw new UnauthorizedApiError("Missing checkout invoice id")
    }

    const bookingId = await publicFinanceService.getInvoiceBookingId(c.get("db"), invoiceId)
    if (!bookingId) {
      return notFound(c, "Invoice not found")
    }

    await requireBookingCheckoutCapability(c, bookingId, action)
    await next()
  }
}

export function createPublicFinanceRoutes(options: PublicFinanceRouteOptions = {}) {
  const resolveDocumentDownloadUrl = (bindings: unknown, storageKey: string) =>
    options.resolveDocumentDownloadUrl?.(bindings, storageKey) ?? null

  return (
    new Hono<Env>()
      .post("/vouchers/validate", async (c) => {
        const input = await parseJsonBody(c, publicValidateVoucherSchema)
        if (input.bookingId) {
          await requireBookingCheckoutCapability(c, input.bookingId, "payment:read")
        }

        const result = await publicFinanceService.validateVoucher(c.get("db"), input)

        return c.json({ data: result })
      })
      .get("/documents/by-reference", async (c) => {
        const query = parseQuery(c, publicFinanceDocumentLookupQuerySchema)
        const document = await publicFinanceService.getDocumentByReference(c.get("db"), query, {
          resolveDocumentDownloadUrl: (storageKey) => resolveDocumentDownloadUrl(c.env, storageKey),
        })

        if (document?.bookingId) {
          await requireBookingCheckoutCapability(c, document.bookingId, "payment:read")
        }

        return document ? c.json({ data: document }) : notFound(c, "Finance document not found")
      })
      .get("/bookings/:bookingId/documents", async (c) => {
        await requireBookingCheckoutCapability(c, c.req.param("bookingId"), "payment:read")

        const documents = await publicFinanceService.getBookingDocuments(
          c.get("db"),
          c.req.param("bookingId"),
          {
            resolveDocumentDownloadUrl: (storageKey) =>
              resolveDocumentDownloadUrl(c.env, storageKey),
          },
        )

        return documents ? c.json({ data: documents }) : notFound(c, "Booking documents not found")
      })
      .get("/bookings/:bookingId/documents/by-reference", async (c) => {
        await requireBookingCheckoutCapability(c, c.req.param("bookingId"), "payment:read")
        const query = parseQuery(c, publicFinanceDocumentLookupQuerySchema)

        const document = await publicFinanceService.getBookingDocumentByReference(
          c.get("db"),
          c.req.param("bookingId"),
          query,
          {
            resolveDocumentDownloadUrl: (storageKey) =>
              resolveDocumentDownloadUrl(c.env, storageKey),
          },
        )

        return document ? c.json({ data: document }) : notFound(c, "Finance document not found")
      })
      .get("/bookings/:bookingId/payments", async (c) => {
        await requireBookingCheckoutCapability(c, c.req.param("bookingId"), "payment:read")

        const payments = await publicFinanceService.getBookingPayments(
          c.get("db"),
          c.req.param("bookingId"),
        )

        return payments ? c.json({ data: payments }) : notFound(c, "Booking payments not found")
      })
      .get("/bookings/:bookingId/payment-options", async (c) => {
        await requireBookingCheckoutCapability(c, c.req.param("bookingId"), "payment:read")

        const paymentOptions = await publicFinanceService.getBookingPaymentOptions(
          c.get("db"),
          c.req.param("bookingId"),
          parseQuery(c, publicPaymentOptionsQuerySchema),
        )

        return paymentOptions
          ? c.json({ data: paymentOptions })
          : notFound(c, "Booking payment options not found")
      })
      .get("/payment-sessions/:sessionId", async (c) => {
        // No capability check: the session id is itself the bearer
        // credential — anyone the operator shared `/pay/:sessionId` with
        // needs to read it, and the projection is already redacted
        // (no PII beyond payerEmail/payerName which the operator chose
        // to share when issuing the link). Trip-issued sessions already
        // worked this way (no bookingId attached → no check); admin-
        // initiated booking sessions need the same access.
        const session = await publicFinanceService.getPaymentSession(
          c.get("db"),
          c.req.param("sessionId"),
        )

        return session ? c.json({ data: session }) : notFound(c, "Payment session not found")
      })
      .post(
        "/bookings/:bookingId/payment-schedules/:scheduleId/payment-session",
        bookingCheckoutCapability("payment:start"),
        idempotencyKey(),
        async (c) => {
          try {
            const session = await publicFinanceService.startBookingSchedulePaymentSession(
              c.get("db"),
              c.req.param("bookingId"),
              c.req.param("scheduleId"),
              await parseJsonBody(c, publicStartPaymentSessionSchema),
            )

            return session
              ? c.json({ data: session }, 201)
              : notFound(c, "Booking payment schedule not found")
          } catch (error) {
            return c.json({ error: paymentConflictError(error) }, 409)
          }
        },
      )
      .post(
        "/bookings/:bookingId/guarantees/:guaranteeId/payment-session",
        bookingCheckoutCapability("payment:start"),
        idempotencyKey(),
        async (c) => {
          try {
            const session = await publicFinanceService.startBookingGuaranteePaymentSession(
              c.get("db"),
              c.req.param("bookingId"),
              c.req.param("guaranteeId"),
              await parseJsonBody(c, publicStartPaymentSessionSchema),
            )

            return session
              ? c.json({ data: session }, 201)
              : notFound(c, "Booking guarantee not found")
          } catch (error) {
            return c.json({ error: paymentConflictError(error) }, 409)
          }
        },
      )
      .post(
        "/invoices/:invoiceId/payment-session",
        invoiceCheckoutCapability("payment:start"),
        idempotencyKey(),
        async (c) => {
          try {
            const session = await publicFinanceService.startInvoicePaymentSession(
              c.get("db"),
              c.req.param("invoiceId"),
              await parseJsonBody(c, publicStartPaymentSessionSchema),
            )

            return session ? c.json({ data: session }, 201) : notFound(c, "Invoice not found")
          } catch (error) {
            return c.json({ error: paymentConflictError(error) }, 409)
          }
        },
      )

      // ----- Accountant portal (revocable token link, RFC §13.2) -----
      // Token is the credential; each route resolves the share + its period scope.
      .get("/accountant/:token/summary", async (c) => {
        const resolution = await accountantSharesService.resolve(c.get("db"), c.req.param("token"))
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
          baseCurrency: scope.baseCurrency ?? undefined,
        }
        const [departures, products] = await Promise.all([
          financeService.getDepartureProfitability(c.get("db"), query),
          financeService.getProductProfitability(c.get("db"), query),
        ])
        return c.json({ data: { scope, departures, products } })
      })
      .get("/accountant/:token/invoices", async (c) => {
        const resolution = await accountantSharesService.resolve(c.get("db"), c.req.param("token"))
        if (resolution.status === "not_found") return notFound(c, "Share not found")
        if (resolution.status === "gone") return c.json({ error: "Share expired or revoked" }, 410)
        const invoices = await accountantSharesService.getInvoicesWithAttachments(
          c.get("db"),
          resolution.scope,
        )
        return c.json({ data: invoices })
      })
      .get(
        "/accountant/:token/invoices/:invoiceId/attachments/:attachmentId/download",
        async (c) => {
          const resolution = await accountantSharesService.resolve(
            c.get("db"),
            c.req.param("token"),
          )
          if (resolution.status === "not_found") return notFound(c, "Share not found")
          if (resolution.status === "gone")
            return c.json({ error: "Share expired or revoked" }, 410)
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
        },
      )
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
        for (const att of attachments) {
          const download = await resolveStoredDocumentDownload(
            { storageKey: att.storageKey },
            { bindings: c.env, resolveDocumentDownloadUrl },
          )
          if (download.status !== "ready") continue
          const res = await fetch(download.download.url)
          if (!res.ok) continue
          const bytes = new Uint8Array(await res.arrayBuffer())
          // Group by client/supplier folder; dedupe collisions.
          let path = `${att.kind}/${sanitizeZipName(att.invoiceNumber)}-${sanitizeZipName(att.name)}`
          let n = 1
          while (used.has(path)) {
            path = `${att.kind}/${sanitizeZipName(att.invoiceNumber)}-${n}-${sanitizeZipName(att.name)}`
            n += 1
          }
          used.add(path)
          files[path] = bytes
        }
        if (Object.keys(files).length === 0) {
          return notFound(c, "No invoice documents are available")
        }
        const zipped = zipSync(files)
        return new Response(zipped, {
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
        const report = c.req.param("report")
        const query = {
          from: resolution.scope.from ?? undefined,
          to: resolution.scope.to ?? undefined,
          baseCurrency: resolution.scope.baseCurrency ?? undefined,
        }
        if (report === "departures") {
          const data = await financeService.getDepartureProfitability(c.get("db"), query)
          return csvResponse(buildDepartureProfitabilityCsv(data), "departure-profitability.csv")
        }
        if (report === "products") {
          const data = await financeService.getProductProfitability(c.get("db"), query)
          return csvResponse(buildProductProfitabilityCsv(data), "product-profitability.csv")
        }
        if (report === "invoices") {
          const data = await accountantSharesService.getInvoicesWithAttachments(
            c.get("db"),
            resolution.scope,
          )
          return csvResponse(buildAccountantInvoicesCsv(data), "invoices.csv")
        }
        return notFound(c, "Unknown report")
      })
  )
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

export const publicFinanceRoutes = createPublicFinanceRoutes()

export type PublicFinanceRoutes = typeof publicFinanceRoutes
