import { parseJsonBody, parseQuery, requireUserId } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import { FINANCE_ROUTE_RUNTIME_CONTAINER_KEY, type FinanceRouteRuntime } from "./route-runtime.js"
import type { publicFinanceRoutes } from "./routes-public.js"
import type { Env } from "./routes-shared.js"
import { financeService, PaymentValidationError } from "./service.js"
import { VoucherServiceError } from "./service-vouchers.js"
import {
  agingReportQuerySchema,
  applyDefaultBookingPaymentPlanSchema,
  cancelPaymentSessionSchema,
  completePaymentSessionSchema,
  createPaymentSessionFromGuaranteeSchema,
  createPaymentSessionFromInvoiceSchema,
  createPaymentSessionFromScheduleSchema,
  expirePaymentSessionSchema,
  failPaymentSessionSchema,
  financeAggregatesQuerySchema,
  insertBookingGuaranteeSchema,
  insertBookingItemCommissionSchema,
  insertBookingItemTaxLineSchema,
  insertBookingPaymentScheduleSchema,
  insertCreditNoteLineItemSchema,
  insertCreditNoteSchema,
  insertFinanceNoteSchema,
  insertInvoiceAttachmentSchema,
  insertInvoiceExternalRefSchema,
  insertInvoiceLineItemSchema,
  insertInvoiceNumberSeriesSchema,
  insertInvoiceSchema,
  insertInvoiceTemplateSchema,
  insertPaymentAuthorizationSchema,
  insertPaymentCaptureSchema,
  insertPaymentInstrumentSchema,
  insertPaymentSchema,
  insertPaymentSessionSchema,
  insertSupplierPaymentSchema,
  insertTaxClassSchema,
  insertTaxPolicyProfileSchema,
  insertTaxPolicyRuleSchema,
  insertTaxRegimeSchema,
  insertVoucherSchema,
  invoiceFromBookingSchema,
  invoiceListQuerySchema,
  invoiceNumberSeriesListQuerySchema,
  invoiceTemplateListQuerySchema,
  markPaymentSessionRequiresRedirectSchema,
  paymentAuthorizationListQuerySchema,
  paymentCaptureListQuerySchema,
  paymentInstrumentListQuerySchema,
  paymentListQuerySchema,
  paymentSessionListQuerySchema,
  profitabilityQuerySchema,
  redeemVoucherSchema,
  renderInvoiceInputSchema,
  revenueReportQuerySchema,
  supplierPaymentListQuerySchema,
  taxClassListQuerySchema,
  taxPolicyProfileListQuerySchema,
  taxPolicyRuleListQuerySchema,
  taxRegimeListQuerySchema,
  updateBookingGuaranteeSchema,
  updateBookingItemCommissionSchema,
  updateBookingItemTaxLineSchema,
  updateBookingPaymentScheduleSchema,
  updateCreditNoteSchema,
  updateInvoiceAttachmentSchema,
  updateInvoiceLineItemSchema,
  updateInvoiceNumberSeriesSchema,
  updateInvoiceSchema,
  updateInvoiceTemplateSchema,
  updatePaymentAuthorizationSchema,
  updatePaymentCaptureSchema,
  updatePaymentInstrumentSchema,
  updatePaymentSessionSchema,
  updateSupplierPaymentSchema,
  updateTaxClassSchema,
  updateTaxPolicyProfileSchema,
  updateTaxPolicyRuleSchema,
  updateTaxRegimeSchema,
  updateVoucherSchema,
  voucherListQuerySchema,
} from "./validation.js"

// ==========================================================================
// Finance Routes — method-chained for Hono RPC type inference
// ==========================================================================

function getMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  return metadata as Record<string, unknown>
}

function maybeUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null
}

function getFallbackDownloadUrl(metadata: unknown) {
  const record = getMetadataRecord(metadata)
  if (!record) {
    return null
  }

  return maybeUrl(record.url)
}

function getFinanceRouteRuntime(c: { var: { container?: { resolve: <T>(key: string) => T } } }) {
  try {
    return c.var.container?.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
  } catch {
    return undefined
  }
}

function getActionLedgerRequestContext(c: Context<Env>) {
  const context = {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }

  if (
    context.userId ||
    context.agentId ||
    context.workflowPrincipalId ||
    context.apiTokenId ||
    context.isInternalRequest
  ) {
    return context
  }

  return undefined
}

export const financeRoutes = new Hono<Env>()

  // ========================================================================
  // Dashboard aggregates
  // ========================================================================

  .get("/aggregates", async (c) => {
    const query = parseQuery(c, financeAggregatesQuerySchema)
    return c.json({ data: await financeService.getFinanceAggregates(c.get("db"), query) })
  })

  // ========================================================================
  // Payment Sessions
  // ========================================================================

  .get("/payment-sessions", async (c) => {
    const query = parseQuery(c, paymentSessionListQuerySchema)
    return c.json(await financeService.listPaymentSessions(c.get("db"), query))
  })

  .post("/payment-sessions", async (c) => {
    return c.json(
      {
        data: await financeService.createPaymentSession(
          c.get("db"),
          await parseJsonBody(c, insertPaymentSessionSchema),
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
    const row = await financeService.updatePaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentSessionSchema),
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/requires-redirect", async (c) => {
    const row = await financeService.markPaymentSessionRequiresRedirect(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, markPaymentSessionRequiresRedirectSchema),
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/complete", async (c) => {
    const runtime = (() => {
      try {
        return c.var.container?.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
      } catch {
        return undefined
      }
    })()
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
  })

  .post("/payment-sessions/:id/fail", async (c) => {
    const row = await financeService.failPaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, failPaymentSessionSchema),
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/cancel", async (c) => {
    const row = await financeService.cancelPaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, cancelPaymentSessionSchema),
    )
    if (!row) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: row })
  })

  .post("/payment-sessions/:id/expire", async (c) => {
    const row = await financeService.expirePaymentSession(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, expirePaymentSessionSchema),
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
    return c.json(
      {
        data: await financeService.createPaymentInstrument(
          c.get("db"),
          await parseJsonBody(c, insertPaymentInstrumentSchema),
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
    const row = await financeService.updatePaymentInstrument(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentInstrumentSchema),
    )
    if (!row) return c.json({ error: "Payment instrument not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/payment-instruments/:id", async (c) => {
    const row = await financeService.deletePaymentInstrument(c.get("db"), c.req.param("id"))
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
    return c.json(
      {
        data: await financeService.createPaymentAuthorization(
          c.get("db"),
          await parseJsonBody(c, insertPaymentAuthorizationSchema),
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
    const row = await financeService.updatePaymentAuthorization(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentAuthorizationSchema),
    )
    if (!row) return c.json({ error: "Payment authorization not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/payment-authorizations/:id", async (c) => {
    const row = await financeService.deletePaymentAuthorization(c.get("db"), c.req.param("id"))
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
    return c.json(
      {
        data: await financeService.createPaymentCapture(
          c.get("db"),
          await parseJsonBody(c, insertPaymentCaptureSchema),
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
    const row = await financeService.updatePaymentCapture(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePaymentCaptureSchema),
    )
    if (!row) return c.json({ error: "Payment capture not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/payment-captures/:id", async (c) => {
    const row = await financeService.deletePaymentCapture(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Payment capture not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Reports (static paths first)
  // ========================================================================

  // GET /reports/revenue — Revenue by month
  .get("/reports/revenue", async (c) => {
    const query = parseQuery(c, revenueReportQuerySchema)
    return c.json({ data: await financeService.getRevenueReport(c.get("db"), query) })
  })

  // GET /reports/aging — Outstanding invoices by age buckets
  .get("/reports/aging", async (c) => {
    const query = parseQuery(c, agingReportQuerySchema)
    return c.json({ data: await financeService.getAgingReport(c.get("db"), query) })
  })

  // GET /reports/profitability — Per-booking margin summary
  .get("/reports/profitability", async (c) => {
    const query = parseQuery(c, profitabilityQuerySchema)
    return c.json({ data: await financeService.getProfitabilityReport(c.get("db"), query) })
  })

  // ========================================================================
  // Booking Payment Schedules
  // ========================================================================

  .get("/bookings/:bookingId/payment-schedules", async (c) => {
    return c.json({
      data: await financeService.listBookingPaymentSchedules(c.get("db"), c.req.param("bookingId")),
    })
  })

  .post("/bookings/:bookingId/payment-schedules", async (c) => {
    const row = await financeService.createBookingPaymentSchedule(
      c.get("db"),
      c.req.param("bookingId"),
      await parseJsonBody(c, insertBookingPaymentScheduleSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .post("/bookings/:bookingId/payment-schedules/default-plan", async (c) => {
    const rows = await financeService.applyDefaultBookingPaymentPlan(
      c.get("db"),
      c.req.param("bookingId"),
      await parseJsonBody(c, applyDefaultBookingPaymentPlanSchema),
    )

    if (!rows) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: rows }, 201)
  })

  .patch("/bookings/:bookingId/payment-schedules/:scheduleId", async (c) => {
    const row = await financeService.updateBookingPaymentSchedule(
      c.get("db"),
      c.req.param("scheduleId"),
      await parseJsonBody(c, updateBookingPaymentScheduleSchema),
    )

    if (!row) {
      return c.json({ error: "Payment schedule not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/bookings/:bookingId/payment-schedules/:scheduleId/payment-session", async (c) => {
    try {
      const row = await financeService.createPaymentSessionFromBookingSchedule(
        c.get("db"),
        c.req.param("scheduleId"),
        await parseJsonBody(c, createPaymentSessionFromScheduleSchema),
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
    const row = await financeService.deleteBookingPaymentSchedule(
      c.get("db"),
      c.req.param("scheduleId"),
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
    const row = await financeService.createBookingGuarantee(
      c.get("db"),
      c.req.param("bookingId"),
      await parseJsonBody(c, insertBookingGuaranteeSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .post("/bookings/:bookingId/guarantees/:guaranteeId/payment-session", async (c) => {
    try {
      const row = await financeService.createPaymentSessionFromBookingGuarantee(
        c.get("db"),
        c.req.param("guaranteeId"),
        await parseJsonBody(c, createPaymentSessionFromGuaranteeSchema),
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
    const row = await financeService.updateBookingGuarantee(
      c.get("db"),
      c.req.param("guaranteeId"),
      await parseJsonBody(c, updateBookingGuaranteeSchema),
    )

    if (!row) {
      return c.json({ error: "Booking guarantee not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/bookings/:bookingId/guarantees/:guaranteeId", async (c) => {
    const row = await financeService.deleteBookingGuarantee(c.get("db"), c.req.param("guaranteeId"))

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

  // ========================================================================
  // Unified Payments (customer + supplier)
  // ========================================================================

  // GET /payments — List customer + supplier payments
  .get("/payments", async (c) => {
    const query = parseQuery(c, paymentListQuerySchema)
    return c.json(await financeService.listAllPayments(c.get("db"), query))
  })

  // GET /payments/:id — Look up a single payment (customer or supplier)
  // Dispatches by typeid prefix: spay_* → supplier, pay_* → customer.
  .get("/payments/:id", async (c) => {
    const row = await financeService.getPaymentById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Payment not found" }, 404)
    }
    return c.json({ data: row })
  })

  // ========================================================================
  // Supplier Payments
  // ========================================================================

  // GET /supplier-payments — List supplier payments
  .get("/supplier-payments", async (c) => {
    const query = parseQuery(c, supplierPaymentListQuerySchema)
    return c.json(await financeService.listSupplierPayments(c.get("db"), query))
  })

  // POST /supplier-payments — Record supplier payment
  .post("/supplier-payments", async (c) => {
    return c.json(
      {
        data: await financeService.createSupplierPayment(
          c.get("db"),
          await parseJsonBody(c, insertSupplierPaymentSchema),
        ),
      },
      201,
    )
  })

  // PATCH /supplier-payments/:id — Update supplier payment
  .patch("/supplier-payments/:id", async (c) => {
    const row = await financeService.updateSupplierPayment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateSupplierPaymentSchema),
    )

    if (!row) {
      return c.json({ error: "Supplier payment not found" }, 404)
    }

    return c.json({ data: row })
  })

  // ========================================================================
  // Invoices CRUD
  // ========================================================================

  // GET /invoices — List invoices
  .get("/invoices", async (c) => {
    const query = parseQuery(c, invoiceListQuerySchema)
    return c.json(await financeService.listInvoices(c.get("db"), query))
  })

  // POST /invoices — Create invoice
  .post("/invoices", async (c) => {
    return c.json(
      {
        data: await financeService.createInvoice(
          c.get("db"),
          await parseJsonBody(c, insertInvoiceSchema),
        ),
      },
      201,
    )
  })

  // POST /invoices/from-booking — Create + issue invoice (or proforma) from booking + booking items
  .post("/invoices/from-booking", async (c) => {
    const input = await parseJsonBody(c, invoiceFromBookingSchema)
    const db = c.get("db")
    const [
      { bookingItems, bookings },
      { eq },
      { issueInvoiceFromBooking, issueProformaFromBooking },
    ] = await Promise.all([
      import("@voyantjs/bookings/schema"),
      import("drizzle-orm"),
      import("./service-issue.js"),
    ])

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1)

    if (!booking) {
      return c.json({ error: "Booking not found" }, 404)
    }

    const items = await db.select().from(bookingItems).where(eq(bookingItems.bookingId, booking.id))

    const runtime = (() => {
      try {
        return c.var.container?.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
      } catch {
        return undefined
      }
    })()

    const issuer =
      input.invoiceType === "proforma" ? issueProformaFromBooking : issueInvoiceFromBooking

    const row = await issuer(
      db,
      input,
      {
        booking: {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          personId: booking.personId,
          organizationId: booking.organizationId,
          sellCurrency: booking.sellCurrency,
          baseCurrency: booking.baseCurrency,
          fxRateSetId: null,
          sellAmountCents: booking.sellAmountCents,
          baseSellAmountCents: booking.baseSellAmountCents,
        },
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unitSellAmountCents: item.unitSellAmountCents,
          totalSellAmountCents: item.totalSellAmountCents,
        })),
      },
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.invoice.from_booking.route",
      },
    )

    return c.json({ data: row }, 201)
  })

  // GET /invoices/:id — Get single invoice
  .get("/invoices/:id", async (c) => {
    const row = await financeService.getInvoiceById(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row })
  })

  // PATCH /invoices/:id — Update invoice
  .patch("/invoices/:id", async (c) => {
    const row = await financeService.updateInvoice(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateInvoiceSchema),
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /invoices/:id — Delete invoice (draft only)
  .delete("/invoices/:id", async (c) => {
    const result = await financeService.deleteInvoice(c.get("db"), c.req.param("id"))

    if (result.status === "not_found") {
      return c.json({ error: "Invoice not found" }, 404)
    }

    if (result.status === "not_draft") {
      return c.json({ error: "Only draft invoices can be deleted" }, 400)
    }

    return c.json({ success: true }, 200)
  })

  .post("/invoices/:id/payment-session", async (c) => {
    try {
      const row = await financeService.createPaymentSessionFromInvoice(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, createPaymentSessionFromInvoiceSchema),
      )

      if (!row) {
        return c.json({ error: "Invoice not found" }, 404)
      }

      return c.json({ data: row }, 201)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create payment session"
      return c.json({ error: message }, 409)
    }
  })

  // ========================================================================
  // Invoice Line Items
  // ========================================================================

  // GET /invoices/:id/line-items — List line items
  .get("/invoices/:id/line-items", async (c) => {
    return c.json({
      data: await financeService.listInvoiceLineItems(c.get("db"), c.req.param("id")),
    })
  })

  // POST /invoices/:id/line-items — Add line item
  .post("/invoices/:id/line-items", async (c) => {
    const row = await financeService.createInvoiceLineItem(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertInvoiceLineItemSchema),
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /invoices/:id/line-items/:lineId — Update line item
  .patch("/invoices/:id/line-items/:lineId", async (c) => {
    const row = await financeService.updateInvoiceLineItem(
      c.get("db"),
      c.req.param("lineId"),
      await parseJsonBody(c, updateInvoiceLineItemSchema),
    )

    if (!row) {
      return c.json({ error: "Line item not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /invoices/:id/line-items/:lineId — Delete line item
  .delete("/invoices/:id/line-items/:lineId", async (c) => {
    const row = await financeService.deleteInvoiceLineItem(c.get("db"), c.req.param("lineId"))

    if (!row) {
      return c.json({ error: "Line item not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ========================================================================
  // Payments
  // ========================================================================

  // GET /invoices/:id/payments — List payments
  .get("/invoices/:id/payments", async (c) => {
    return c.json({ data: await financeService.listPayments(c.get("db"), c.req.param("id")) })
  })

  // POST /invoices/:id/payments — Record payment (transaction)
  .post("/invoices/:id/payments", async (c) => {
    try {
      const runtime = getFinanceRouteRuntime(c)
      const row = await financeService.createPayment(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, insertPaymentSchema),
        {
          eventBus: runtime?.eventBus,
          actionLedgerContext: getActionLedgerRequestContext(c),
          actionLedgerAuthorizationSource: "finance.payment.route",
        },
      )

      if (!row) {
        return c.json({ error: "Invoice not found" }, 404)
      }

      return c.json({ data: row }, 201)
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

  // ========================================================================
  // Credit Notes
  // ========================================================================

  // GET /invoices/:id/credit-notes — List credit notes
  .get("/invoices/:id/credit-notes", async (c) => {
    return c.json({
      data: await financeService.listCreditNotes(c.get("db"), c.req.param("id")),
    })
  })

  // POST /invoices/:id/credit-notes — Create credit note
  .post("/invoices/:id/credit-notes", async (c) => {
    const runtime = getFinanceRouteRuntime(c)
    const row = await financeService.createCreditNote(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertCreditNoteSchema),
      {
        eventBus: runtime?.eventBus,
        actionLedgerContext: getActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "finance.credit_note.route",
      },
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /invoices/:id/credit-notes/:creditNoteId — Update credit note
  .patch("/invoices/:id/credit-notes/:creditNoteId", async (c) => {
    const row = await financeService.updateCreditNote(
      c.get("db"),
      c.req.param("creditNoteId"),
      await parseJsonBody(c, updateCreditNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Credit note not found" }, 404)
    }

    return c.json({ data: row })
  })

  // ========================================================================
  // Credit Note Line Items
  // ========================================================================

  // GET /invoices/:id/credit-notes/:creditNoteId/line-items — List credit note line items
  .get("/invoices/:id/credit-notes/:creditNoteId/line-items", async (c) => {
    return c.json({
      data: await financeService.listCreditNoteLineItems(c.get("db"), c.req.param("creditNoteId")),
    })
  })

  // POST /invoices/:id/credit-notes/:creditNoteId/line-items — Add credit note line item
  .post("/invoices/:id/credit-notes/:creditNoteId/line-items", async (c) => {
    const row = await financeService.createCreditNoteLineItem(
      c.get("db"),
      c.req.param("creditNoteId"),
      await parseJsonBody(c, insertCreditNoteLineItemSchema),
    )

    if (!row) {
      return c.json({ error: "Credit note not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ========================================================================
  // Finance Notes
  // ========================================================================

  // GET /invoices/:id/notes — List notes
  .get("/invoices/:id/notes", async (c) => {
    return c.json({ data: await financeService.listNotes(c.get("db"), c.req.param("id")) })
  })

  // POST /invoices/:id/notes — Add note
  .post("/invoices/:id/notes", async (c) => {
    const userId = requireUserId(c)

    const row = await financeService.createNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertFinanceNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Invoice not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ========================================================================
  // Invoice Number Series
  // ========================================================================

  .get("/invoice-number-series", async (c) => {
    const query = parseQuery(c, invoiceNumberSeriesListQuerySchema)
    return c.json(await financeService.listInvoiceNumberSeries(c.get("db"), query))
  })

  .post("/invoice-number-series", async (c) => {
    const row = await financeService.createInvoiceNumberSeries(
      c.get("db"),
      await parseJsonBody(c, insertInvoiceNumberSeriesSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/invoice-number-series/:id", async (c) => {
    const row = await financeService.getInvoiceNumberSeriesById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice number series not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/invoice-number-series/:id", async (c) => {
    const row = await financeService.updateInvoiceNumberSeries(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateInvoiceNumberSeriesSchema),
    )
    if (!row) return c.json({ error: "Invoice number series not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/invoice-number-series/:id", async (c) => {
    const row = await financeService.deleteInvoiceNumberSeries(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice number series not found" }, 404)
    return c.json({ success: true })
  })

  .post("/invoice-number-series/:id/allocate", async (c) => {
    const result = await financeService.allocateInvoiceNumber(c.get("db"), c.req.param("id"))
    if (result.status === "not_found") {
      return c.json({ error: "Invoice number series not found" }, 404)
    }
    if (result.status === "inactive") {
      return c.json({ error: "Invoice number series is inactive" }, 409)
    }
    return c.json({
      data: { sequence: result.sequence, formattedNumber: result.formattedNumber },
    })
  })

  // ========================================================================
  // Invoice Templates
  // ========================================================================

  .get("/invoice-templates", async (c) => {
    const query = parseQuery(c, invoiceTemplateListQuerySchema)
    return c.json(await financeService.listInvoiceTemplates(c.get("db"), query))
  })

  .post("/invoice-templates", async (c) => {
    const row = await financeService.createInvoiceTemplate(
      c.get("db"),
      await parseJsonBody(c, insertInvoiceTemplateSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/invoice-templates/:id", async (c) => {
    const row = await financeService.getInvoiceTemplateById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice template not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/invoice-templates/:id", async (c) => {
    const row = await financeService.updateInvoiceTemplate(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateInvoiceTemplateSchema),
    )
    if (!row) return c.json({ error: "Invoice template not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/invoice-templates/:id", async (c) => {
    const row = await financeService.deleteInvoiceTemplate(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Invoice template not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Regimes
  // ========================================================================

  .get("/tax-regimes", async (c) => {
    const query = parseQuery(c, taxRegimeListQuerySchema)
    return c.json(await financeService.listTaxRegimes(c.get("db"), query))
  })

  .post("/tax-regimes", async (c) => {
    const row = await financeService.createTaxRegime(
      c.get("db"),
      await parseJsonBody(c, insertTaxRegimeSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-regimes/:id", async (c) => {
    const row = await financeService.getTaxRegimeById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax regime not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-regimes/:id", async (c) => {
    const row = await financeService.updateTaxRegime(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxRegimeSchema),
    )
    if (!row) return c.json({ error: "Tax regime not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-regimes/:id", async (c) => {
    const row = await financeService.deleteTaxRegime(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax regime not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Classes
  // ========================================================================

  .get("/tax-classes", async (c) => {
    const query = parseQuery(c, taxClassListQuerySchema)
    return c.json(await financeService.listTaxClasses(c.get("db"), query))
  })

  .post("/tax-classes", async (c) => {
    const row = await financeService.createTaxClass(
      c.get("db"),
      await parseJsonBody(c, insertTaxClassSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-classes/:id", async (c) => {
    const row = await financeService.getTaxClassById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax class not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-classes/:id", async (c) => {
    const row = await financeService.updateTaxClass(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxClassSchema),
    )
    if (!row) return c.json({ error: "Tax class not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-classes/:id", async (c) => {
    const row = await financeService.deleteTaxClass(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax class not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Policy Profiles
  // ========================================================================

  .get("/tax-policy-profiles", async (c) => {
    const query = parseQuery(c, taxPolicyProfileListQuerySchema)
    return c.json(await financeService.listTaxPolicyProfiles(c.get("db"), query))
  })

  .post("/tax-policy-profiles", async (c) => {
    const row = await financeService.createTaxPolicyProfile(
      c.get("db"),
      await parseJsonBody(c, insertTaxPolicyProfileSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-policy-profiles/:id", async (c) => {
    const row = await financeService.getTaxPolicyProfileById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy profile not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-policy-profiles/:id", async (c) => {
    const row = await financeService.updateTaxPolicyProfile(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxPolicyProfileSchema),
    )
    if (!row) return c.json({ error: "Tax policy profile not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-policy-profiles/:id", async (c) => {
    const row = await financeService.deleteTaxPolicyProfile(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy profile not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Tax Policy Rules
  // ========================================================================

  .get("/tax-policy-rules", async (c) => {
    const query = parseQuery(c, taxPolicyRuleListQuerySchema)
    return c.json(await financeService.listTaxPolicyRules(c.get("db"), query))
  })

  .post("/tax-policy-rules", async (c) => {
    const row = await financeService.createTaxPolicyRule(
      c.get("db"),
      await parseJsonBody(c, insertTaxPolicyRuleSchema),
    )
    return c.json({ data: row }, 201)
  })

  .get("/tax-policy-rules/:id", async (c) => {
    const row = await financeService.getTaxPolicyRuleById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy rule not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/tax-policy-rules/:id", async (c) => {
    const row = await financeService.updateTaxPolicyRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateTaxPolicyRuleSchema),
    )
    if (!row) return c.json({ error: "Tax policy rule not found" }, 404)
    return c.json({ data: row })
  })

  .delete("/tax-policy-rules/:id", async (c) => {
    const row = await financeService.deleteTaxPolicyRule(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Tax policy rule not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Invoice Renditions & External Refs (nested under invoice)
  // ========================================================================

  .get("/invoices/:id/renditions", async (c) => {
    const rows = await financeService.listInvoiceRenditions(c.get("db"), c.req.param("id"))
    return c.json({ data: rows })
  })

  .get("/invoices/:id/attachments", async (c) => {
    const rows = await financeService.listInvoiceAttachments(c.get("db"), c.req.param("id"))
    return c.json({ data: rows })
  })

  .post("/invoices/:id/attachments", async (c) => {
    const row = await financeService.createInvoiceAttachment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertInvoiceAttachmentSchema),
    )
    if (!row) return c.json({ error: "Invoice not found" }, 404)
    return c.json({ data: row }, 201)
  })

  .patch("/invoices/:id/attachments/:attachmentId", async (c) => {
    const row = await financeService.updateInvoiceAttachment(
      c.get("db"),
      c.req.param("id"),
      c.req.param("attachmentId"),
      await parseJsonBody(c, updateInvoiceAttachmentSchema),
    )
    if (!row) return c.json({ error: "Attachment not found" }, 404)
    return c.json({ data: row })
  })

  .get("/invoice-attachments/:id/download", async (c) => {
    const attachment = await financeService.getInvoiceAttachmentById(c.get("db"), c.req.param("id"))
    if (!attachment) return c.json({ error: "Attachment not found" }, 404)

    let location: string | null = null
    if (attachment.storageKey) {
      const runtime = getFinanceRouteRuntime(c)
      if (!runtime?.resolveDocumentDownloadUrl) {
        return c.json({ error: "Document download resolver is not configured" }, 501)
      }
      location = await runtime.resolveDocumentDownloadUrl(c.env, attachment.storageKey)
    }

    location ??= getFallbackDownloadUrl(attachment.metadata)
    if (!location) {
      return c.json({ error: "Attachment file is not available" }, 404)
    }

    return c.redirect(location, 302)
  })

  .delete("/invoices/:id/attachments/:attachmentId", async (c) => {
    const row = await financeService.deleteInvoiceAttachment(
      c.get("db"),
      c.req.param("id"),
      c.req.param("attachmentId"),
    )
    if (!row) return c.json({ error: "Attachment not found" }, 404)
    return c.json({ success: true })
  })

  .post("/invoices/:id/render", async (c) => {
    const input = await parseJsonBody(c, renderInvoiceInputSchema)
    const result = await financeService.renderInvoice(c.get("db"), c.req.param("id"), input)
    if (result.status === "not_found") return c.json({ error: "Invoice not found" }, 404)
    return c.json({ data: result.rendition }, 201)
  })

  .get("/invoices/:id/external-refs", async (c) => {
    const rows = await financeService.listInvoiceExternalRefs(c.get("db"), c.req.param("id"))
    return c.json({ data: rows })
  })

  .post("/invoices/:id/external-refs", async (c) => {
    const row = await financeService.registerInvoiceExternalRef(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertInvoiceExternalRefSchema),
    )
    if (!row) return c.json({ error: "Invoice not found" }, 404)
    return c.json({ data: row }, 201)
  })

  .delete("/invoices/:id/external-refs/:refId", async (c) => {
    const row = await financeService.deleteInvoiceExternalRef(c.get("db"), c.req.param("refId"))
    if (!row) return c.json({ error: "External ref not found" }, 404)
    return c.json({ success: true })
  })

  // ========================================================================
  // Vouchers — issuance, lookup, redemption
  // ========================================================================

  .get("/vouchers", async (c) => {
    const query = parseQuery(c, voucherListQuerySchema)
    return c.json(await financeService.vouchers.list(c.get("db"), query))
  })

  .post("/vouchers", async (c) => {
    try {
      const row = await financeService.vouchers.create(
        c.get("db"),
        await parseJsonBody(c, insertVoucherSchema),
        c.get("userId"),
      )
      return c.json({ data: row }, 201)
    } catch (error) {
      if (error instanceof VoucherServiceError && error.code === "code_in_use") {
        return c.json({ error: "Voucher code already in use" }, 409)
      }
      throw error
    }
  })

  .get("/vouchers/:id", async (c) => {
    const row = await financeService.vouchers.getById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Voucher not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/vouchers/:id", async (c) => {
    const row = await financeService.vouchers.update(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateVoucherSchema),
    )
    if (!row) return c.json({ error: "Voucher not found" }, 404)
    return c.json({ data: row })
  })

  .post("/vouchers/:id/redeem", async (c) => {
    try {
      const result = await financeService.vouchers.redeem(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, redeemVoucherSchema),
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    } catch (error) {
      if (error instanceof VoucherServiceError) {
        const status =
          error.code === "voucher_not_found"
            ? 404
            : error.code === "insufficient_balance"
              ? 409
              : 422
        return c.json({ error: error.code }, status)
      }
      throw error
    }
  })

  // ========================================================================
  // Booking-scoped reads (admin)
  // ========================================================================
  // Mirror the customer-portal's `/v1/public/finance/bookings/:bookingId/payments`
  // endpoint on the admin surface. The admin actor guard
  // (`requireActor("staff")`) blocks staff sessions from hitting the
  // public path, but operators absolutely need to see the canonical
  // `payments` rows on the booking detail page. This handler reuses
  // the same publicFinanceService helper so the response shape is
  // identical to the customer-portal flow.
  .get("/bookings/:bookingId/payments", async (c) => {
    const { publicFinanceService } = await import("./service-public.js")
    const result = await publicFinanceService.getBookingPayments(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!result) {
      return c.json({ error: "Booking payments not found" }, 404)
    }
    return c.json({ data: result })
  })

export type FinanceRoutes = typeof financeRoutes
export type PublicFinanceRoutes = typeof publicFinanceRoutes
