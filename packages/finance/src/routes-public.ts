import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  type CheckoutCapabilityAction,
  requireCheckoutCapability,
} from "@voyant-travel/bookings/checkout-capability"
import { idempotencyKey, openApiValidationHook, UnauthorizedApiError } from "@voyant-travel/hono"
import type { PaymentAdapter, PaymentAdapterRuntimeContext } from "@voyant-travel/payments"
import type { Context, MiddlewareHandler } from "hono"

import { FINANCE_ROUTE_RUNTIME_CONTAINER_KEY } from "./route-runtime.js"
import { createPublicAccountantRoutes } from "./routes-public-accountant.js"
import { type Env, getRuntimeEnv, notFound } from "./routes-shared.js"
import { publicFinanceService } from "./service-public.js"
import type { FinanceServiceRuntime } from "./service-shared.js"
import {
  publicBookingFinanceDocumentsSchema,
  publicBookingFinancePaymentsSchema,
  publicBookingPaymentOptionsSchema,
  publicFinanceDocumentLookupQuerySchema,
  publicFinanceDocumentLookupSchema,
  publicPaymentOptionsQuerySchema,
  publicPaymentSessionSchema,
  publicStartPaymentSessionSchema,
  publicTravelCreditValidationSchema,
  publicValidateTravelCreditSchema,
} from "./validation-public.js"

export interface PublicFinanceRouteOptions {
  resolveDocumentDownloadUrl?: (
    bindings: unknown,
    storageKey: string,
  ) => Promise<string | null> | string | null
  paymentStatusAdapter?: PaymentAdapter | null
  resolvePaymentStatusAdapter?: (bindings: unknown) => PaymentAdapter | null | undefined
  resolvePaymentStatusContext?: (
    bindings: unknown,
  ) => PaymentAdapterRuntimeContext | null | undefined
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

function resolvePaymentStatusRefresh(c: Context<Env>, options: PublicFinanceRouteOptions) {
  const adapter =
    options.resolvePaymentStatusAdapter?.(c.env) ?? options.paymentStatusAdapter ?? null
  if (!adapter) return undefined

  const container = c.var.container
  const routeRuntime = container?.has(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
    ? container.resolve<FinanceServiceRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
    : undefined
  const eventBus = c.var.eventBus ?? routeRuntime?.eventBus
  const runtime = routeRuntime ?? (eventBus ? { eventBus } : undefined)

  return {
    adapter,
    context: options.resolvePaymentStatusContext?.(c.env) ?? { env: getRuntimeEnv(c) },
    ...(runtime ? { runtime } : {}),
  }
}

// ─────────────────────────────────────────────────────────────────
// Travel credits + finance-document lookup (anonymous; bookingId-bound legs
// re-check the checkout capability in the handler).
// ─────────────────────────────────────────────────────────────────

const validateTravelCreditRoute = createRoute({
  "x-voyant-api-id": "@voyant-travel/finance#api.public",
  method: "post",
  path: "/travel-credits/validate",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: publicValidateTravelCreditSchema } },
    },
  },
  responses: {
    200: {
      description: "Travel credit validity result",
      content: {
        "application/json": { schema: z.object({ data: publicTravelCreditValidationSchema }) },
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

export function createPublicFinanceRoutes(options: PublicFinanceRouteOptions = {}) {
  const resolveDocumentDownloadUrl = (bindings: unknown, storageKey: string) =>
    options.resolveDocumentDownloadUrl?.(bindings, storageKey) ?? null

  const travelCreditDocumentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(validateTravelCreditRoute, async (c) => {
      const input = c.req.valid("json")
      if (input.bookingId) {
        await requireBookingCheckoutCapability(c, input.bookingId, "payment:read")
      }

      const result = await publicFinanceService.validateTravelCredit(c.get("db"), input)

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
      const paymentStatusRefresh = resolvePaymentStatusRefresh(c, options)
      const session = await publicFinanceService.getPaymentSession(
        c.get("db"),
        c.req.valid("param").sessionId,
        paymentStatusRefresh ? { paymentStatusRefresh } : undefined,
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

  const accountantRoutes = createPublicAccountantRoutes(options)
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .route("/", travelCreditDocumentRoutes)
    .route("/", bookingReadRoutes)
    .route("/", paymentSessionChain)
    .route("/", accountantRoutes)
}

export const publicFinanceRoutes = createPublicFinanceRoutes()

export type PublicFinanceRoutes = typeof publicFinanceRoutes
