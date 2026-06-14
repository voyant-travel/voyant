import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import { getActionLedgerRequestContext, getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService, PaymentValidationError } from "./service.js"
import {
  cancelPaymentSessionSchema,
  completePaymentSessionSchema,
  expirePaymentSessionSchema,
  failPaymentSessionSchema,
  insertPaymentAuthorizationSchema,
  insertPaymentCaptureSchema,
  insertPaymentInstrumentSchema,
  insertPaymentSessionSchema,
  markPaymentSessionRequiresRedirectSchema,
  paymentAuthorizationListQuerySchema,
  paymentCaptureListQuerySchema,
  paymentInstrumentListQuerySchema,
  paymentSessionListQuerySchema,
  updatePaymentAuthorizationSchema,
  updatePaymentCaptureSchema,
  updatePaymentInstrumentSchema,
  updatePaymentSessionSchema,
} from "./validation.js"

export const financePaymentProcessingRoutes = new Hono<Env>()

  // ========================================================================
  // Payment Sessions
  // ========================================================================

  .get("/payment-sessions", async (c) => {
    const query = parseQuery(c, paymentSessionListQuerySchema)
    return c.json(await financeService.listPaymentSessions(c.get("db"), query))
  })

  .post("/payment-sessions", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    return c.json(
      {
        data: await financeService.createPaymentSession(
          c.get("db"),
          await parseJsonBody(c, insertPaymentSessionSchema),
          {
            eventBus: runtime?.eventBus,
            actionLedgerContext: getActionLedgerRequestContext(c),
            actionLedgerAuthorizationSource: "finance.payment_session.route",
          },
        ),
      },
      201,
    )
  })

  .get("/payment-sessions/:id", async (c) => {
    const row = await financeService.getPaymentSessionById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/payment-sessions/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentSessionSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/requires-redirect", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.markPaymentSessionRequiresRedirect(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, markPaymentSessionRequiresRedirectSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/complete", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.completePaymentSession(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, completePaymentSessionSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.payment_session.route",
        },
      )
      if (!row) return c.json({ error: "Payment session not found" }, 404)
      return c.json({ data: row })
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

  .post("/payment-sessions/:id/fail", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.failPaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, failPaymentSessionSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/cancel", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.cancelPaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, cancelPaymentSessionSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/expire", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.expirePaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, expirePaymentSessionSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_session.route",
      },
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  // ========================================================================
  // Payment Instruments
  // ========================================================================

  .get("/payment-instruments", async (c) => {
    const query = parseQuery(c, paymentInstrumentListQuerySchema)
    return c.json(await financeService.listPaymentInstruments(c.get("db"), query))
  })

  .post("/payment-instruments", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    return c.json(
      {
        data: await financeService.createPaymentInstrument(
          c.get("db"),
          await parseJsonBody(c, insertPaymentInstrumentSchema),
          {
            eventBus: runtime?.eventBus,
            actionLedgerContext: getActionLedgerRequestContext(c),
            actionLedgerAuthorizationSource: "finance.payment_instrument.route",
          },
        ),
      },
      201,
    )
  })

  .get("/payment-instruments/:id", async (c) => {
    const row = await financeService.getPaymentInstrumentById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Payment instrument not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/payment-instruments/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentInstrument(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentInstrumentSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_instrument.route",
      },
    )
    if (!row) return c.json({ error: "Payment instrument not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/payment-instruments/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePaymentInstrument(c.get("db"), c.req.param("id"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_instrument.route",
    })
    if (!row) return c.json({ error: "Payment instrument not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Payment Authorizations
  // ========================================================================

  .get("/payment-authorizations", async (c) => {
    const query = parseQuery(c, paymentAuthorizationListQuerySchema)
    return c.json(await financeService.listPaymentAuthorizations(c.get("db"), query))
  })

  .post("/payment-authorizations", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    return c.json(
      {
        data: await financeService.createPaymentAuthorization(
          c.get("db"),
          await parseJsonBody(c, insertPaymentAuthorizationSchema),
          {
            eventBus: runtime?.eventBus,
            actionLedgerContext: getActionLedgerRequestContext(c),
            actionLedgerAuthorizationSource: "finance.payment_authorization.route",
          },
        ),
      },
      201,
    )
  })

  .get("/payment-authorizations/:id", async (c) => {
    const row = await financeService.getPaymentAuthorizationById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Payment authorization not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/payment-authorizations/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentAuthorization(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentAuthorizationSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_authorization.route",
      },
    )
    if (!row) return c.json({ error: "Payment authorization not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/payment-authorizations/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePaymentAuthorization(c.get("db"), c.req.param("id"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_authorization.route",
    })
    if (!row) return c.json({ error: "Payment authorization not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Payment Captures
  // ========================================================================

  .get("/payment-captures", async (c) => {
    const query = parseQuery(c, paymentCaptureListQuerySchema)
    return c.json(await financeService.listPaymentCaptures(c.get("db"), query))
  })

  .post("/payment-captures", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    return c.json(
      {
        data: await financeService.createPaymentCapture(
          c.get("db"),
          await parseJsonBody(c, insertPaymentCaptureSchema),
          {
            eventBus: runtime?.eventBus,
            actionLedgerContext: getActionLedgerRequestContext(c),
            actionLedgerAuthorizationSource: "finance.payment_capture.route",
          },
        ),
      },
      201,
    )
  })

  .get("/payment-captures/:id", async (c) => {
    const row = await financeService.getPaymentCaptureById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Payment capture not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/payment-captures/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updatePaymentCapture(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentCaptureSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.payment_capture.route",
      },
    )
    if (!row) return c.json({ error: "Payment capture not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/payment-captures/:id", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deletePaymentCapture(c.get("db"), c.req.param("id"), {
      eventBus: runtime?.eventBus,
      actionLedgerContext: getActionLedgerRequestContext(c),
      actionLedgerAuthorizationSource: "finance.payment_capture.route",
    })
    if (!row) return c.json({ error: "Payment capture not found" }, 404)
    return c.json({ success: true })
  })
