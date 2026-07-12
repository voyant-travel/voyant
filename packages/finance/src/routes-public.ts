import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  type CheckoutCapabilityAction,
  requireCheckoutCapability,
} from "@voyant-travel/bookings/checkout-capability"
import { idempotencyKey, openApiValidationHook, UnauthorizedApiError } from "@voyant-travel/hono"
import { zipSync } from "fflate"
import type { Context, MiddlewareHandler } from "hono"

import { resolveStoredDocumentDownload } from "./document-download.js"
import { getFinanceRouteRuntime } from "./routes-runtime.js"
import { type Env, getRuntimeEnv, notFound } from "./routes-shared.js"
import { financeService } from "./service.js"
import { accountantSharesService, buildAccountantInvoicesCsv } from "./service-accountant-shares.js"
import {
  buildDepartureProfitabilityCsv,
  buildProductProfitabilityCsv,
} from "./service-profitability.js"
import { publicFinanceService } from "./service-public.js"
import {
  publicBookingFinanceDocumentsSchema,
  publicBookingFinancePaymentsSchema,
  publicBookingPaymentOptionsSchema,
  publicFinanceDocumentLookupQuerySchema,
  publicFinanceDocumentLookupSchema,
  publicPaymentOptionsQuerySchema,
  publicPaymentSessionSchema,
  publicStartPaymentSessionSchema,
  publicValidateVoucherSchema,
  publicVoucherValidationSchema,
} from "./validation-public.js"

export interface PublicFinanceRouteOptions {
  resolveDocumentDownloadUrl?: (
    bindings: unknown,
    storageKey: string,
  ) => Promise<string | null> | string | null
}

const errorResponseSchema = z.object({ error: z.string() })

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

// ─────────────────────────────────────────────────────────────────
// Vouchers + finance-document lookup (anonymous; bookingId-bound legs
// re-check the checkout capability in the handler).
// ─────────────────────────────────────────────────────────────────

const validateVoucherRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "post",
  path: "/vouchers/validate",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: publicValidateVoucherSchema } },
    },
  },
  responses: {
    200: {
      description: "Voucher validity result",
      content: {
        "application/json": { schema: z.object({ data: publicVoucherValidationSchema }) },
      },
    },
  },
})

const documentByReferenceRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/documents/by-reference",
  request: { query: publicFinanceDocumentLookupQuerySchema },
  responses: {
    200: {
      description: "Finance document resolved by external reference",
      content: {
        "application/json": { schema: z.object({ data: publicFinanceDocumentLookupSchema }) },
      },
    },
    404: {
      description: "Finance document not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// ─────────────────────────────────────────────────────────────────
// Booking-scoped reads + payment-session read (checkout capability is
// the per-booking credential; the session id is its own bearer).
// ─────────────────────────────────────────────────────────────────

const bookingParamsSchema = z.object({ bookingId: z.string() })

const bookingDocumentsRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/bookings/{bookingId}/documents",
  request: { params: bookingParamsSchema },
  responses: {
    200: {
      description: "Finance documents for a booking",
      content: {
        "application/json": { schema: z.object({ data: publicBookingFinanceDocumentsSchema }) },
      },
    },
    404: {
      description: "Booking documents not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const bookingDocumentByReferenceRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/bookings/{bookingId}/documents/by-reference",
  request: { params: bookingParamsSchema, query: publicFinanceDocumentLookupQuerySchema },
  responses: {
    200: {
      description: "Finance document for a booking resolved by external reference",
      content: {
        "application/json": { schema: z.object({ data: publicFinanceDocumentLookupSchema }) },
      },
    },
    404: {
      description: "Finance document not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const bookingPaymentsRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/bookings/{bookingId}/payments",
  request: { params: bookingParamsSchema },
  responses: {
    200: {
      description: "Payments recorded against a booking",
      content: {
        "application/json": { schema: z.object({ data: publicBookingFinancePaymentsSchema }) },
      },
    },
    404: {
      description: "Booking payments not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const bookingPaymentOptionsRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/bookings/{bookingId}/payment-options",
  request: { params: bookingParamsSchema, query: publicPaymentOptionsQuerySchema },
  responses: {
    200: {
      description: "Payment options (instruments, schedules, guarantees) for a booking",
      content: {
        "application/json": { schema: z.object({ data: publicBookingPaymentOptionsSchema }) },
      },
    },
    404: {
      description: "Booking payment options not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const paymentSessionByIdRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "get",
  path: "/payment-sessions/{sessionId}",
  request: { params: z.object({ sessionId: z.string() }) },
  responses: {
    200: {
      description: "A redacted public payment-session projection",
      content: { "application/json": { schema: z.object({ data: publicPaymentSessionSchema }) } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// ─────────────────────────────────────────────────────────────────
// Payment-session mutations (capability + idempotency middleware).
// ─────────────────────────────────────────────────────────────────

const startSchedulePaymentSessionRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "post",
  path: "/bookings/{bookingId}/payment-schedules/{scheduleId}/payment-session",
  request: {
    params: z.object({ bookingId: z.string(), scheduleId: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: publicStartPaymentSessionSchema } },
    },
  },
  responses: {
    201: {
      description: "Started payment session for a booking payment schedule",
      content: { "application/json": { schema: z.object({ data: publicPaymentSessionSchema }) } },
    },
    404: {
      description: "Booking payment schedule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Payment session could not be started",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const startGuaranteePaymentSessionRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "post",
  path: "/bookings/{bookingId}/guarantees/{guaranteeId}/payment-session",
  request: {
    params: z.object({ bookingId: z.string(), guaranteeId: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: publicStartPaymentSessionSchema } },
    },
  },
  responses: {
    201: {
      description: "Started payment session for a booking guarantee",
      content: { "application/json": { schema: z.object({ data: publicPaymentSessionSchema }) } },
    },
    404: {
      description: "Booking guarantee not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Payment session could not be started",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const startInvoicePaymentSessionRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "post",
  path: "/invoices/{invoiceId}/payment-session",
  request: {
    params: z.object({ invoiceId: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: publicStartPaymentSessionSchema } },
    },
  },
  responses: {
    201: {
      description: "Started payment session for an invoice",
      content: { "application/json": { schema: z.object({ data: publicPaymentSessionSchema }) } },
    },
    404: {
      description: "Invoice not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Payment session could not be started",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

// ─────────────────────────────────────────────────────────────────
// Accountant portal (revocable token link, RFC §13.2). The profitability
// rollups have no first-class wire schema, so the JSON legs document a
// permissive `data` envelope; the binary legs (attachment download, zip,
// CSV export) stay as raw `Response` handlers that cannot be expressed as
// a JSON response body.
// ─────────────────────────────────────────────────────────────────

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

export function createPublicFinanceRoutes(options: PublicFinanceRouteOptions = {}) {
  const resolveDocumentDownloadUrl = (bindings: unknown, storageKey: string) =>
    options.resolveDocumentDownloadUrl?.(bindings, storageKey) ?? null

  const voucherDocumentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(validateVoucherRoute, async (c) => {
      const input = c.req.valid("json")
      if (input.bookingId) {
        await requireBookingCheckoutCapability(c, input.bookingId, "payment:read")
      }

      const result = await publicFinanceService.validateVoucher(c.get("db"), input)

      return c.json({ data: result }, 200)
    })
    .openapi(documentByReferenceRoute, async (c) => {
      const query = c.req.valid("query")
      const document = await publicFinanceService.getDocumentByReference(c.get("db"), query, {
        resolveDocumentDownloadUrl: (storageKey) => resolveDocumentDownloadUrl(c.env, storageKey),
      })

      if (document?.bookingId) {
        await requireBookingCheckoutCapability(c, document.bookingId, "payment:read")
      }

      return document ? c.json({ data: document }, 200) : notFound(c, "Finance document not found")
    })

  const bookingReadRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(bookingDocumentsRoute, async (c) => {
      const { bookingId } = c.req.valid("param")
      await requireBookingCheckoutCapability(c, bookingId, "payment:read")

      const documents = await publicFinanceService.getBookingDocuments(c.get("db"), bookingId, {
        resolveDocumentDownloadUrl: (storageKey) => resolveDocumentDownloadUrl(c.env, storageKey),
      })

      return documents
        ? c.json({ data: documents }, 200)
        : notFound(c, "Booking documents not found")
    })
    .openapi(bookingDocumentByReferenceRoute, async (c) => {
      const { bookingId } = c.req.valid("param")
      await requireBookingCheckoutCapability(c, bookingId, "payment:read")
      const query = c.req.valid("query")

      const document = await publicFinanceService.getBookingDocumentByReference(
        c.get("db"),
        bookingId,
        query,
        {
          resolveDocumentDownloadUrl: (storageKey) => resolveDocumentDownloadUrl(c.env, storageKey),
        },
      )

      return document ? c.json({ data: document }, 200) : notFound(c, "Finance document not found")
    })
    .openapi(bookingPaymentsRoute, async (c) => {
      const { bookingId } = c.req.valid("param")
      await requireBookingCheckoutCapability(c, bookingId, "payment:read")

      const payments = await publicFinanceService.getBookingPayments(c.get("db"), bookingId)

      return payments ? c.json({ data: payments }, 200) : notFound(c, "Booking payments not found")
    })
    .openapi(bookingPaymentOptionsRoute, async (c) => {
      const { bookingId } = c.req.valid("param")
      await requireBookingCheckoutCapability(c, bookingId, "payment:read")

      const paymentOptions = await publicFinanceService.getBookingPaymentOptions(
        c.get("db"),
        bookingId,
        c.req.valid("query"),
      )

      return paymentOptions
        ? c.json({ data: paymentOptions }, 200)
        : notFound(c, "Booking payment options not found")
    })
    .openapi(paymentSessionByIdRoute, async (c) => {
      // No capability check: the session id is itself the bearer
      // credential — anyone the operator shared `/pay/:sessionId` with
      // needs to read it, and the projection is already redacted
      // (no PII beyond payerEmail/payerName which the operator chose
      // to share when issuing the link). Trip-issued sessions already
      // worked this way (no bookingId attached → no check); admin-
      // initiated booking sessions need the same access.
      const session = await publicFinanceService.getPaymentSession(
        c.get("db"),
        c.req.valid("param").sessionId,
      )

      return session ? c.json({ data: session }, 200) : notFound(c, "Payment session not found")
    })

  const paymentSessionRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  paymentSessionRoutes.use(
    "/bookings/:bookingId/payment-schedules/:scheduleId/payment-session",
    bookingCheckoutCapability("payment:start"),
    idempotencyKey(),
  )
  paymentSessionRoutes.use(
    "/bookings/:bookingId/guarantees/:guaranteeId/payment-session",
    bookingCheckoutCapability("payment:start"),
    idempotencyKey(),
  )
  paymentSessionRoutes.use(
    "/invoices/:invoiceId/payment-session",
    invoiceCheckoutCapability("payment:start"),
    idempotencyKey(),
  )

  const paymentSessionChain = paymentSessionRoutes
    .openapi(startSchedulePaymentSessionRoute, async (c) => {
      const { bookingId, scheduleId } = c.req.valid("param")
      try {
        const session = await publicFinanceService.startBookingSchedulePaymentSession(
          c.get("db"),
          bookingId,
          scheduleId,
          c.req.valid("json"),
        )

        return session
          ? c.json({ data: session }, 201)
          : notFound(c, "Booking payment schedule not found")
      } catch (error) {
        return c.json({ error: paymentConflictError(error) }, 409)
      }
    })
    .openapi(startGuaranteePaymentSessionRoute, async (c) => {
      const { bookingId, guaranteeId } = c.req.valid("param")
      try {
        const session = await publicFinanceService.startBookingGuaranteePaymentSession(
          c.get("db"),
          bookingId,
          guaranteeId,
          c.req.valid("json"),
        )

        return session ? c.json({ data: session }, 201) : notFound(c, "Booking guarantee not found")
      } catch (error) {
        return c.json({ error: paymentConflictError(error) }, 409)
      }
    })
    .openapi(startInvoicePaymentSessionRoute, async (c) => {
      const { invoiceId } = c.req.valid("param")
      try {
        const session = await publicFinanceService.startInvoicePaymentSession(
          c.get("db"),
          invoiceId,
          c.req.valid("json"),
        )

        return session ? c.json({ data: session }, 201) : notFound(c, "Invoice not found")
      } catch (error) {
        return c.json({ error: paymentConflictError(error) }, 409)
      }
    })

  const accountantRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
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
      // The base-currency rollup is always computed in the operator accounting
      // base (snapshotted at each invoice's issue-date rate) — no viewer-chosen
      // base, no re-valuation at the latest rate.
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
    // Binary download legs: raw `Response` (redirect / zip / CSV) that cannot be
    // expressed as a JSON response body, so they stay as plain Hono handlers.
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
      }
      const fx = getFinanceRouteRuntime(c)
      if (report === "departures") {
        const data = await financeService.getDepartureProfitability(c.get("db"), query, fx)
        return csvResponse(buildDepartureProfitabilityCsv(data), "departure-profitability.csv")
      }
      if (report === "products") {
        const data = await financeService.getProductProfitability(c.get("db"), query, fx)
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

  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .route("/", voucherDocumentRoutes)
    .route("/", bookingReadRoutes)
    .route("/", paymentSessionChain)
    .route("/", accountantRoutes)
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
