/**
 * Admin payment-processing routes — mounted by the operator starter under
 * `/v1/admin/finance/...`. Covers the provider-facing payment lifecycle:
 * payment sessions (+ requires-redirect / complete / fail / cancel / expire
 * transitions), payment instruments, payment authorizations, and payment
 * captures.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9C). Request schemas reuse the existing
 * `@voyant-travel/finance-contracts` schemas the handlers already parse;
 * response schemas come from the shared `routes-payment-schemas.ts` row shapes
 * and the `paymentSessionSchema` in `routes-invoice-schemas.ts` (authored from
 * the Drizzle `$inferSelect` shapes; §17 dates → strings).
 *
 * Optional bodies (§3): the `complete` / `fail` / `cancel` / `expire` session
 * transitions accept a JSON body whose fields are all optional (an empty body
 * is valid), so they do NOT declare an OpenAPI `request.body` — Hono's JSON
 * validator would reject a zero-length `application/json` request before the
 * handler runs. They parse the body in the handler via `parseOptionalJsonBody`
 * and document the optional fields in the route `description`. The
 * `requires-redirect` transition has a required `redirectUrl`, so it keeps a
 * declared required body.
 *
 * Each resource is its own small `OpenAPIHono` sub-chain composed onto
 * `financePaymentProcessingRoutes` via `.route("/")` so the `.openapi()`
 * operations propagate up through the parent `financeRoutes` registry while
 * keeping type-inference cost bounded (one flat chain has O(n²) inference cost).
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * CRUD + lifecycle bundle over four payment-processing resources (24 legs),
 * each with a `createRoute` def + handler co-located per the established admin
 * route pattern (mirrors the sibling `routes-invoice-core.ts`). Splitting per
 * resource would fragment the single mounted instance without aiding review.
 * See voyant#2114 / voyant#2208.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook, parseOptionalJsonBody } from "@voyant-travel/hono"
import { listResponseSchema, paginationSchema } from "@voyant-travel/types"

import {
  errorResponseSchema,
  paymentSessionSchema,
  successResponseSchema,
} from "./routes-invoice-schemas.js"
import {
  paymentAuthorizationSchema,
  paymentCaptureSchema,
  paymentInstrumentSchema,
} from "./routes-payment-schemas.js"
import { getActionLedgerRequestContext, getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService, PaymentValidationError } from "./service.js"
import {
  cancelPaymentSessionSchema,
  completePaymentSessionSchema,
  expirePaymentSessionSchema,
  failPaymentSessionSchema,
  insertPaymentAuthorizationBodySchema,
  insertPaymentCaptureSchema,
  insertPaymentInstrumentSchema,
  insertPaymentSessionBodySchema,
  markPaymentSessionRequiresRedirectSchema,
  paymentAuthorizationStatusSchema,
  paymentCaptureListQuerySchema,
  paymentInstrumentListQuerySchema,
  paymentSessionStatusSchema,
  paymentSessionTargetTypeSchema,
  updatePaymentAuthorizationBodySchema,
  updatePaymentCaptureSchema,
  updatePaymentInstrumentSchema,
  updatePaymentSessionBodySchema,
} from "./validation.js"

const idParamSchema = z.object({ id: z.string() })

/**
 * The shared `paymentSessionListQuerySchema` / `paymentAuthorizationListQuerySchema`
 * are `ZodIntersection`s (their `withLegacyOrderCompatibility` wrapper `.and()`s a
 * `{ orderId?: never }` ban onto the base object), which OpenAPI's `request.query`
 * `RouteParameter` slot cannot accept (and the `ZodNever` is not renderable by the
 * spec generator). These local `ZodObject` mirrors carry the same documented query
 * fields plus the `legacyOrderId` shim; the generic-`orderId` ban is a no-op here
 * since `orderId` is simply not a declared parameter.
 */
const paymentSessionListQueryParamsSchema = paginationSchema.extend({
  bookingId: z.string().optional(),
  invoiceId: z.string().optional(),
  bookingPaymentScheduleId: z.string().optional(),
  bookingGuaranteeId: z.string().optional(),
  targetType: paymentSessionTargetTypeSchema.optional(),
  status: paymentSessionStatusSchema.optional(),
  provider: z.string().optional(),
  providerConnectionId: z.string().optional(),
  providerSessionId: z.string().optional(),
  providerPaymentId: z.string().optional(),
  externalReference: z.string().optional(),
  clientReference: z.string().optional(),
  idempotencyKey: z.string().optional(),
  legacyOrderId: z.string().optional().nullable(),
})

const paymentAuthorizationListQueryParamsSchema = paginationSchema.extend({
  bookingId: z.string().optional(),
  invoiceId: z.string().optional(),
  bookingGuaranteeId: z.string().optional(),
  paymentInstrumentId: z.string().optional(),
  status: paymentAuthorizationStatusSchema.optional(),
  legacyOrderId: z.string().optional().nullable(),
})

/** `PaymentValidationError` serializes as `{ error, code, details? }`. */
const paymentValidationErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

// --- payment sessions -----------------------------------------------------

const listPaymentSessionsRoute = createRoute({
  method: "get",
  path: "/payment-sessions",
  request: { query: paymentSessionListQueryParamsSchema.strict() },
  responses: {
    200: {
      description: "List of payment sessions",
      content: { "application/json": { schema: listResponseSchema(paymentSessionSchema) } },
    },
  },
})

const createPaymentSessionRoute = createRoute({
  method: "post",
  path: "/payment-sessions",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPaymentSessionBodySchema.strict() } },
    },
  },
  responses: {
    201: {
      description: "The created payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getPaymentSessionRoute = createRoute({
  method: "get",
  path: "/payment-sessions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePaymentSessionRoute = createRoute({
  method: "patch",
  path: "/payment-sessions/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePaymentSessionBodySchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "The updated payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const requiresRedirectPaymentSessionRoute = createRoute({
  method: "post",
  path: "/payment-sessions/{id}/requires-redirect",
  description:
    "Mark a session as requiring a provider redirect. Requires `redirectUrl`; " +
    "the other provider/reference fields are optional.",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: markPaymentSessionRequiresRedirectSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const completePaymentSessionRoute = createRoute({
  method: "post",
  path: "/payment-sessions/{id}/complete",
  description:
    "Mark a session complete (authorized/paid). Accepts an optional JSON body " +
    "(all fields optional; an empty body is accepted) with: `status` " +
    "(authorized|paid, default paid), `providerSessionId`, `providerPaymentId`, " +
    "`externalReference`, `paymentMethod`, `paymentInstrumentId`, `captureMode`, " +
    "`externalAuthorizationId`, `externalCaptureId`, `approvalCode`, " +
    "`authorizedAt`, `capturedAt`, `settledAt`, `paymentDate`, `expiresAt`, " +
    "`referenceNumber`, `notes`, `providerPayload`, `metadata`. The body is " +
    "parsed in the handler (not a declared OpenAPI request body) because Hono's " +
    "JSON validator would reject a zero-length `application/json` request.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The completed payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    400: {
      description: "The completion failed business-rule validation",
      content: { "application/json": { schema: paymentValidationErrorSchema } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "The session cannot be completed from its current state",
      content: { "application/json": { schema: paymentValidationErrorSchema } },
    },
  },
})

const failPaymentSessionRoute = createRoute({
  method: "post",
  path: "/payment-sessions/{id}/fail",
  description:
    "Mark a session failed. Accepts an optional JSON body (all fields optional; " +
    "an empty body is accepted) with: `providerSessionId`, `providerPaymentId`, " +
    "`externalReference`, `failureCode`, `failureMessage`, `notes`, " +
    "`providerPayload`, `metadata`. The body is parsed in the handler (not a " +
    "declared OpenAPI request body) because Hono's JSON validator would reject a " +
    "zero-length `application/json` request.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The failed payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const cancelPaymentSessionRoute = createRoute({
  method: "post",
  path: "/payment-sessions/{id}/cancel",
  description:
    "Cancel a session. Accepts an optional JSON body (all fields optional; an " +
    "empty body is accepted) with: `notes`, `providerPayload`, `metadata`, " +
    "`cancelledAt`. The body is parsed in the handler (not a declared OpenAPI " +
    "request body) because Hono's JSON validator would reject a zero-length " +
    "`application/json` request.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The cancelled payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const expirePaymentSessionRoute = createRoute({
  method: "post",
  path: "/payment-sessions/{id}/expire",
  description:
    "Expire a session. Accepts an optional JSON body (all fields optional; an " +
    "empty body is accepted) with: `notes`, `providerPayload`, `metadata`, " +
    "`expiredAt`. The body is parsed in the handler (not a declared OpenAPI " +
    "request body) because Hono's JSON validator would reject a zero-length " +
    "`application/json` request.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The expired payment session",
      content: { "application/json": { schema: z.object({ data: paymentSessionSchema }) } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const paymentSessionRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPaymentSessionsRoute, async (c) =>
    c.json(await financeService.listPaymentSessions(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPaymentSessionRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createPaymentSession(c.get("db"), c.req.valid("json"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_session.route",
    })
    if (!row) {
      throw new Error("Failed to create payment session")
    }
    return c.json({ data: row }, 201)
  })
  .openapi(getPaymentSessionRoute, async (c) => {
    const row = await financeService.getPaymentSessionById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment session not found" }, 404)
  })
  .openapi(updatePaymentSessionRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentSession(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment session not found" }, 404)
  })
  .openapi(requiresRedirectPaymentSessionRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.markPaymentSessionRequiresRedirect(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment session not found" }, 404)
  })
  .openapi(completePaymentSessionRoute, async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.completePaymentSession(
        c.get("db"),
        c.req.valid("param").id,
        await parseOptionalJsonBody(c, completePaymentSessionSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.payment_session.route",
        },
      )
      return row ? c.json({ data: row }, 200) : c.json({ error: "Payment session not found" }, 404)
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        return c.json(
          { error: error.message, code: error.code, details: error.details },
          error.status,
        )
      }
      throw error
    }
  })
  .openapi(failPaymentSessionRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.failPaymentSession(
      c.get("db"),
      c.req.valid("param").id,
      await parseOptionalJsonBody(c, failPaymentSessionSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment session not found" }, 404)
  })
  .openapi(cancelPaymentSessionRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.cancelPaymentSession(
      c.get("db"),
      c.req.valid("param").id,
      await parseOptionalJsonBody(c, cancelPaymentSessionSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment session not found" }, 404)
  })
  .openapi(expirePaymentSessionRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.expirePaymentSession(
      c.get("db"),
      c.req.valid("param").id,
      await parseOptionalJsonBody(c, expirePaymentSessionSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment session not found" }, 404)
  })

// --- payment instruments --------------------------------------------------

const listPaymentInstrumentsRoute = createRoute({
  method: "get",
  path: "/payment-instruments",
  request: { query: paymentInstrumentListQuerySchema },
  responses: {
    200: {
      description: "List of payment instruments",
      content: { "application/json": { schema: listResponseSchema(paymentInstrumentSchema) } },
    },
  },
})

const createPaymentInstrumentRoute = createRoute({
  method: "post",
  path: "/payment-instruments",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPaymentInstrumentSchema } },
    },
  },
  responses: {
    201: {
      description: "The created payment instrument",
      content: { "application/json": { schema: z.object({ data: paymentInstrumentSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getPaymentInstrumentRoute = createRoute({
  method: "get",
  path: "/payment-instruments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The payment instrument",
      content: { "application/json": { schema: z.object({ data: paymentInstrumentSchema }) } },
    },
    404: {
      description: "Payment instrument not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePaymentInstrumentRoute = createRoute({
  method: "patch",
  path: "/payment-instruments/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePaymentInstrumentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated payment instrument",
      content: { "application/json": { schema: z.object({ data: paymentInstrumentSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Payment instrument not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePaymentInstrumentRoute = createRoute({
  method: "delete",
  path: "/payment-instruments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Payment instrument deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Payment instrument not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const paymentInstrumentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPaymentInstrumentsRoute, async (c) =>
    c.json(await financeService.listPaymentInstruments(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPaymentInstrumentRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createPaymentInstrument(c.get("db"), c.req.valid("json"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_instrument.route",
    })
    if (!row) {
      throw new Error("Failed to create payment instrument")
    }
    return c.json({ data: row }, 201)
  })
  .openapi(getPaymentInstrumentRoute, async (c) => {
    const row = await financeService.getPaymentInstrumentById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment instrument not found" }, 404)
  })
  .openapi(updatePaymentInstrumentRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentInstrument(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_instrument.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment instrument not found" }, 404)
  })
  .openapi(deletePaymentInstrumentRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePaymentInstrument(c.get("db"), c.req.valid("param").id, {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_instrument.route",
    })
    return row
      ? c.json({ success: true }, 200)
      : c.json({ error: "Payment instrument not found" }, 404)
  })

// --- payment authorizations -----------------------------------------------

const listPaymentAuthorizationsRoute = createRoute({
  method: "get",
  path: "/payment-authorizations",
  request: { query: paymentAuthorizationListQueryParamsSchema.strict() },
  responses: {
    200: {
      description: "List of payment authorizations",
      content: { "application/json": { schema: listResponseSchema(paymentAuthorizationSchema) } },
    },
  },
})

const createPaymentAuthorizationRoute = createRoute({
  method: "post",
  path: "/payment-authorizations",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPaymentAuthorizationBodySchema.strict() } },
    },
  },
  responses: {
    201: {
      description: "The created payment authorization",
      content: { "application/json": { schema: z.object({ data: paymentAuthorizationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getPaymentAuthorizationRoute = createRoute({
  method: "get",
  path: "/payment-authorizations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The payment authorization",
      content: { "application/json": { schema: z.object({ data: paymentAuthorizationSchema }) } },
    },
    404: {
      description: "Payment authorization not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePaymentAuthorizationRoute = createRoute({
  method: "patch",
  path: "/payment-authorizations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePaymentAuthorizationBodySchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "The updated payment authorization",
      content: { "application/json": { schema: z.object({ data: paymentAuthorizationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Payment authorization not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePaymentAuthorizationRoute = createRoute({
  method: "delete",
  path: "/payment-authorizations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Payment authorization deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Payment authorization not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const paymentAuthorizationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPaymentAuthorizationsRoute, async (c) =>
    c.json(await financeService.listPaymentAuthorizations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPaymentAuthorizationRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createPaymentAuthorization(c.get("db"), c.req.valid("json"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_authorization.route",
    })
    if (!row) {
      throw new Error("Failed to create payment authorization")
    }
    return c.json({ data: row }, 201)
  })
  .openapi(getPaymentAuthorizationRoute, async (c) => {
    const row = await financeService.getPaymentAuthorizationById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Payment authorization not found" }, 404)
  })
  .openapi(updatePaymentAuthorizationRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentAuthorization(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_authorization.route",
      },
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Payment authorization not found" }, 404)
  })
  .openapi(deletePaymentAuthorizationRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePaymentAuthorization(
      c.get("db"),
      c.req.valid("param").id,
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_authorization.route",
      },
    )
    return row
      ? c.json({ success: true }, 200)
      : c.json({ error: "Payment authorization not found" }, 404)
  })

// --- payment captures -----------------------------------------------------

const listPaymentCapturesRoute = createRoute({
  method: "get",
  path: "/payment-captures",
  request: { query: paymentCaptureListQuerySchema },
  responses: {
    200: {
      description: "List of payment captures",
      content: { "application/json": { schema: listResponseSchema(paymentCaptureSchema) } },
    },
  },
})

const createPaymentCaptureRoute = createRoute({
  method: "post",
  path: "/payment-captures",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPaymentCaptureSchema } },
    },
  },
  responses: {
    201: {
      description: "The created payment capture",
      content: { "application/json": { schema: z.object({ data: paymentCaptureSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getPaymentCaptureRoute = createRoute({
  method: "get",
  path: "/payment-captures/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The payment capture",
      content: { "application/json": { schema: z.object({ data: paymentCaptureSchema }) } },
    },
    404: {
      description: "Payment capture not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePaymentCaptureRoute = createRoute({
  method: "patch",
  path: "/payment-captures/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePaymentCaptureSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated payment capture",
      content: { "application/json": { schema: z.object({ data: paymentCaptureSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Payment capture not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePaymentCaptureRoute = createRoute({
  method: "delete",
  path: "/payment-captures/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Payment capture deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Payment capture not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const paymentCaptureRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPaymentCapturesRoute, async (c) =>
    c.json(await financeService.listPaymentCaptures(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPaymentCaptureRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createPaymentCapture(c.get("db"), c.req.valid("json"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_capture.route",
    })
    if (!row) {
      throw new Error("Failed to create payment capture")
    }
    return c.json({ data: row }, 201)
  })
  .openapi(getPaymentCaptureRoute, async (c) => {
    const row = await financeService.getPaymentCaptureById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment capture not found" }, 404)
  })
  .openapi(updatePaymentCaptureRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentCapture(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_capture.route",
      },
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Payment capture not found" }, 404)
  })
  .openapi(deletePaymentCaptureRoute, async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePaymentCapture(c.get("db"), c.req.valid("param").id, {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_capture.route",
    })
    return row
      ? c.json({ success: true }, 200)
      : c.json({ error: "Payment capture not found" }, 404)
  })

export const financePaymentProcessingRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", paymentSessionRoutes)
  .route("/", paymentInstrumentRoutes)
  .route("/", paymentAuthorizationRoutes)
  .route("/", paymentCaptureRoutes)
