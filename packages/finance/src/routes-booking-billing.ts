import { ActionLedgerIdempotencyConflictError } from "@voyant-travel/action-ledger"
import { parseJsonBody } from "@voyant-travel/hono"
import { Hono } from "hono"
import { getActionLedgerRequestContext, getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import { financeService, PaymentValidationError } from "./service.js"
import {
  applyDefaultBookingPaymentPlanSchema,
  createPaymentSessionFromGuaranteeSchema,
  createPaymentSessionFromScheduleSchema,
  insertBookingGuaranteeSchema,
  insertBookingItemCommissionSchema,
  insertBookingItemTaxLineSchema,
  insertBookingPaymentScheduleSchema,
  updateBookingGuaranteeSchema,
  updateBookingItemCommissionSchema,
  updateBookingItemTaxLineSchema,
  updateBookingPaymentScheduleSchema,
} from "./validation.js"

export const financeBookingBillingRoutes = new Hono<Env>()

  // ========================================================================
  // Booking Payment Schedules
  // ========================================================================

  .get("/bookings/:bookingId/payment-schedules", async (c) => {
    return c.json({
      data: await financeService.listBookingPaymentSchedules(c.get("db"), c.req.param("bookingId")),
    })
  })

  .post("/bookings/:bookingId/payment-schedules", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.createBookingPaymentSchedule(
        c.get("db"),
        c.req.param("bookingId"),
        await parseJsonBody(c, insertBookingPaymentScheduleSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.booking_payment_schedule.route",
        },
      )

      if (!row) {
        return c.json({ error: "Booking not found" }, 404)
      }

      return c.json({ data: row }, 201)
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        return c.json(
          { error: error.message, code: error.code, details: error.details },
          error.status,
        )
      }

      if (error instanceof ActionLedgerIdempotencyConflictError) {
        return c.json(
          {
            error: error.message,
            existingActionId: error.existingActionId,
          },
          409,
        )
      }

      throw error
    }
  })

  .post("/bookings/:bookingId/payment-schedules/default-plan", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const rows = await financeService.applyDefaultBookingPaymentPlan(
      c.get("db"),
      c.req.param("bookingId"),
      await parseJsonBody(c, applyDefaultBookingPaymentPlanSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.booking_payment_schedule.default_plan.route",
      },
    )

    if (!rows) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: rows }, 201)
  })

  .patch("/bookings/:bookingId/payment-schedules/:scheduleId", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.updateBookingPaymentSchedule(
        c.get("db"),
        c.req.param("scheduleId"),
        await parseJsonBody(c, updateBookingPaymentScheduleSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.booking_payment_schedule.route",
        },
      )

      if (!row) {
        return c.json({ error: "Payment schedule not found" }, 404)
      }

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

  .post("/bookings/:bookingId/payment-schedules/:scheduleId/payment-session", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.createPaymentSessionFromBookingSchedule(
        c.get("db"),
        c.req.param("scheduleId"),
        await parseJsonBody(c, createPaymentSessionFromScheduleSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.payment_session.route",
        },
      )

      if (!row) {
        return c.json({ error: "Payment schedule not found" }, 404)
      }

      return c.json({ data: row }, 201)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create payment session"
      return c.json({ error: message }, 409)
    }
  })

  .delete("/bookings/:bookingId/payment-schedules/:scheduleId", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deleteBookingPaymentSchedule(
      c.get("db"),
      c.req.param("scheduleId"),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.booking_payment_schedule.route",
      },
    )

    if (!row) {
      return c.json({ error: "Payment schedule not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ========================================================================
  // Booking Guarantees
  // ========================================================================

  .get("/bookings/:bookingId/guarantees", async (c) => {
    return c.json({
      data: await financeService.listBookingGuarantees(c.get("db"), c.req.param("bookingId")),
    })
  })

  .post("/bookings/:bookingId/guarantees", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createBookingGuarantee(
      c.get("db"),
      c.req.param("bookingId"),
      await parseJsonBody(c, insertBookingGuaranteeSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.booking_guarantee.route",
      },
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .post("/bookings/:bookingId/guarantees/:guaranteeId/payment-session", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.createPaymentSessionFromBookingGuarantee(
        c.get("db"),
        c.req.param("guaranteeId"),
        await parseJsonBody(c, createPaymentSessionFromGuaranteeSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.payment_session.route",
        },
      )

      if (!row) {
        return c.json({ error: "Booking guarantee not found" }, 404)
      }

      return c.json({ data: row }, 201)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create payment session"
      return c.json({ error: message }, 409)
    }
  })

  .patch("/bookings/:bookingId/guarantees/:guaranteeId", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.updateBookingGuarantee(
      c.get("db"),
      c.req.param("guaranteeId"),
      await parseJsonBody(c, updateBookingGuaranteeSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.booking_guarantee.route",
      },
    )

    if (!row) {
      return c.json({ error: "Booking guarantee not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/bookings/:bookingId/guarantees/:guaranteeId", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.deleteBookingGuarantee(
      c.get("db"),
      c.req.param("guaranteeId"),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.booking_guarantee.route",
      },
    )

    if (!row) {
      return c.json({ error: "Booking guarantee not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ========================================================================
  // Booking Item Taxes
  // ========================================================================

  .get("/booking-items/:bookingItemId/tax-lines", async (c) => {
    return c.json({
      data: await financeService.listBookingItemTaxLines(c.get("db"), c.req.param("bookingItemId")),
    })
  })

  .post("/booking-items/:bookingItemId/tax-lines", async (c) => {
    const row = await financeService.createBookingItemTaxLine(
      c.get("db"),
      c.req.param("bookingItemId"),
      await parseJsonBody(c, insertBookingItemTaxLineSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/booking-items/:bookingItemId/tax-lines/:taxLineId", async (c) => {
    const row = await financeService.updateBookingItemTaxLine(
      c.get("db"),
      c.req.param("taxLineId"),
      await parseJsonBody(c, updateBookingItemTaxLineSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item tax line not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/booking-items/:bookingItemId/tax-lines/:taxLineId", async (c) => {
    const row = await financeService.deleteBookingItemTaxLine(c.get("db"), c.req.param("taxLineId"))

    if (!row) {
      return c.json({ error: "Booking item tax line not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ========================================================================
  // Booking Item Commissions
  // ========================================================================

  .get("/booking-items/:bookingItemId/commissions", async (c) => {
    return c.json({
      data: await financeService.listBookingItemCommissions(
        c.get("db"),
        c.req.param("bookingItemId"),
      ),
    })
  })

  .post("/booking-items/:bookingItemId/commissions", async (c) => {
    const row = await financeService.createBookingItemCommission(
      c.get("db"),
      c.req.param("bookingItemId"),
      await parseJsonBody(c, insertBookingItemCommissionSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/booking-items/:bookingItemId/commissions/:commissionId", async (c) => {
    const row = await financeService.updateBookingItemCommission(
      c.get("db"),
      c.req.param("commissionId"),
      await parseJsonBody(c, updateBookingItemCommissionSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item commission not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/booking-items/:bookingItemId/commissions/:commissionId", async (c) => {
    const row = await financeService.deleteBookingItemCommission(
      c.get("db"),
      c.req.param("commissionId"),
    )

    if (!row) {
      return c.json({ error: "Booking item commission not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })
