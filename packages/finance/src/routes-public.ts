import {
  type CheckoutCapabilityAction,
  requireCheckoutCapability,
} from "@voyantjs/bookings/checkout-capability"
import { idempotencyKey, parseJsonBody, parseQuery, UnauthorizedApiError } from "@voyantjs/hono"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"

import { type Env, getRuntimeEnv, notFound } from "./routes-shared.js"
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

  return new Hono<Env>()
    .post("/vouchers/validate", async (c) => {
      const input = await parseJsonBody(c, publicValidateVoucherSchema)
      if (input.bookingId) {
        await requireBookingCheckoutCapability(c, input.bookingId, "payment:read")
      }

      const result = await publicFinanceService.validateVoucher(c.get("db"), input)

      return c.json({ data: result })
    })
    .get("/documents/by-reference", async (c) => {
      const document = await publicFinanceService.getDocumentByReference(
        c.get("db"),
        parseQuery(c, publicFinanceDocumentLookupQuerySchema).reference,
        {
          resolveDocumentDownloadUrl: (storageKey) => resolveDocumentDownloadUrl(c.env, storageKey),
        },
      )

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
          resolveDocumentDownloadUrl: (storageKey) => resolveDocumentDownloadUrl(c.env, storageKey),
        },
      )

      return documents ? c.json({ data: documents }) : notFound(c, "Booking documents not found")
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
      const session = await publicFinanceService.getPaymentSession(
        c.get("db"),
        c.req.param("sessionId"),
      )

      if (session?.bookingId) {
        await requireBookingCheckoutCapability(c, session.bookingId, "payment:read")
      }

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
}

export const publicFinanceRoutes = createPublicFinanceRoutes()

export type PublicFinanceRoutes = typeof publicFinanceRoutes
