import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { FINANCE_ROUTE_RUNTIME_CONTAINER_KEY, type FinanceRouteRuntime } from "./route-runtime.js"
import {
  buildInlineDownload,
  getActionLedgerRequestContext,
  resolveWaitRequest,
  routeIdempotencyKey,
} from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import {
  financeService,
  InvoiceFromBookingValidationError,
  InvoiceNumberAllocationError,
  InvoiceNumberConflictError,
} from "./service.js"
import { waitForInvoiceRendition, waitFormatForMode } from "./service-rendition-wait.js"
import {
  insertInvoiceSchema,
  invoiceDocumentWaitQuerySchema,
  invoiceFromBookingSchema,
  invoiceListQuerySchema,
} from "./validation.js"

export const financeInvoiceIssueRoutes = new Hono<Env>()

  // ========================================================================
  // Invoices CRUD
  // ========================================================================

  // GET /invoices — List invoices
  .get("/invoices", async (c) => {
    const query = parseQuery(c, invoiceListQuerySchema)
    return c.json(await financeService.listInvoices(c.get("db"), query))
  })

  // POST /invoices — Create invoice
  .post("/invoices", routeIdempotencyKey("POST /v1/admin/finance/invoices"), async (c) => {
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

  // POST /invoices/from-booking — Create + issue invoice/proforma from a booking or schedule row
  .post(
    "/invoices/from-booking",
    routeIdempotencyKey("POST /v1/admin/finance/invoices/from-booking", {
      fingerprintSearchParams: ["wait", "waitTimeoutMs"],
    }),
    async (c) => {
      const input = await parseJsonBody(c, invoiceFromBookingSchema)
      const waitRequest = resolveWaitRequest(input, parseQuery(c, invoiceDocumentWaitQuerySchema))
      const db = c.get("db")
      const [
        { bookingItems, bookings },
        { bookingPaymentSchedules },
        { and, asc, eq },
        { issueInvoiceFromBooking, issueProformaFromBooking },
      ] = await Promise.all([
        import("@voyantjs/bookings/schema"),
        import("./schema.js"),
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

      const items = await db
        .select()
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, booking.id))
        .orderBy(asc(bookingItems.createdAt), asc(bookingItems.id))
      const [paymentSchedule] = input.bookingPaymentScheduleId
        ? await db
            .select()
            .from(bookingPaymentSchedules)
            .where(
              and(
                eq(bookingPaymentSchedules.id, input.bookingPaymentScheduleId),
                eq(bookingPaymentSchedules.bookingId, booking.id),
              ),
            )
            .limit(1)
        : []

      if (input.bookingPaymentScheduleId && !paymentSchedule) {
        return c.json({ error: "Booking payment schedule not found" }, 404)
      }

      const runtime = (() => {
        try {
          return c.var.container?.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
        } catch {
          return undefined
        }
      })()

      const issuer =
        input.invoiceType === "proforma" ? issueProformaFromBooking : issueInvoiceFromBooking

      let row: Awaited<ReturnType<typeof issuer>>
      try {
        row = await issuer(
          db,
          input,
          {
            booking: {
              id: booking.id,
              bookingNumber: booking.bookingNumber,
              personId: booking.personId,
              organizationId: booking.organizationId,
              startDate: booking.startDate,
              endDate: booking.endDate,
              sellCurrency: booking.sellCurrency,
              baseCurrency: booking.baseCurrency,
              fxRateSetId: booking.fxRateSetId,
              sellAmountCents: booking.sellAmountCents,
              baseSellAmountCents: booking.baseSellAmountCents,
            },
            paymentSchedule: paymentSchedule
              ? {
                  id: paymentSchedule.id,
                  bookingId: paymentSchedule.bookingId,
                  bookingItemId: paymentSchedule.bookingItemId,
                  scheduleType: paymentSchedule.scheduleType,
                  dueDate: paymentSchedule.dueDate,
                  currency: paymentSchedule.currency,
                  amountCents: paymentSchedule.amountCents,
                }
              : null,
            items: items.map((item) => ({
              id: item.id,
              title: item.title,
              productId: item.productId,
              productName: item.productNameSnapshot,
              productNameSnapshot: item.productNameSnapshot,
              optionNameSnapshot: item.optionNameSnapshot,
              unitNameSnapshot: item.unitNameSnapshot,
              departureLabelSnapshot: item.departureLabelSnapshot,
              startDate: item.serviceDate ?? item.startsAt,
              serviceDate: item.serviceDate,
              startsAt: item.startsAt,
              endDate: item.endsAt ?? item.serviceDate,
              endsAt: item.endsAt,
              quantity: item.quantity,
              unitSellAmountCents: item.unitSellAmountCents,
              totalSellAmountCents: item.totalSellAmountCents,
            })),
          },
          {
            ...(runtime ?? {}),
            actionLedgerContext: getActionLedgerRequestContext(c),
            actionLedgerAuthorizationSource: "finance.invoice.from_booking.route",
          },
        )
      } catch (error) {
        if (error instanceof InvoiceNumberAllocationError) {
          return c.json(
            { error: error.code, scope: error.scope, seriesId: error.seriesId ?? null },
            409,
          )
        }
        if (error instanceof InvoiceNumberConflictError) {
          return c.json(
            {
              error: "Invoice number already exists",
              code: error.code,
              invoiceNumber: error.invoiceNumber,
            },
            409,
          )
        }
        if (error instanceof InvoiceFromBookingValidationError) {
          return c.json(
            { error: error.message, code: error.code, details: error.details },
            error.status,
          )
        }
        throw error
      }

      if (!row || waitRequest.mode === "none") {
        return c.json({ data: row }, 201)
      }

      const waitResult = await waitForInvoiceRendition(db, row.id, {
        format: waitFormatForMode(waitRequest.mode),
        timeoutMs: waitRequest.timeoutMs,
      })
      const payload = {
        invoice: row,
        rendition: waitResult.rendition,
      }

      if (waitResult.status !== "ready") {
        return c.json({ data: payload }, 202)
      }

      const download = await buildInlineDownload(c, waitResult.rendition)
      if (download.status !== "ready") {
        return c.json({ data: payload }, 202)
      }

      return c.json({ data: { ...payload, download: download.download } }, 201)
    },
  )

  // POST /invoices/:id/convert-to-invoice — Convert a proforma into a final invoice
  .post("/invoices/:id/convert-to-invoice", async (c) => {
    const { convertProformaToInvoice } = await import("./service-issue.js")
    const input = await c.req
      .json<{ invoiceNumber?: string; issueDate?: string; dueDate?: string }>()
      .catch(() => ({}))

    const runtime = (() => {
      try {
        return c.var.container?.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
      } catch {
        return undefined
      }
    })()

    let result: Awaited<ReturnType<typeof convertProformaToInvoice>>
    try {
      result = await convertProformaToInvoice(c.get("db"), c.req.param("id"), input, {
        eventBus: runtime?.eventBus,
      })
    } catch (error) {
      if (error instanceof InvoiceNumberConflictError) {
        return c.json(
          {
            error: "Invoice number already exists",
            code: error.code,
            invoiceNumber: error.invoiceNumber,
          },
          409,
        )
      }
      throw error
    }

    if (result.status === "not_found") {
      return c.json({ error: "Invoice not found" }, 404)
    }
    if (result.status === "not_proforma") {
      return c.json({ error: "Only proforma invoices can be converted" }, 409)
    }
    if (result.status === "already_converted") {
      return c.json(
        {
          error: "This proforma has already been converted",
          code: "proforma_already_converted",
          existingInvoiceId: result.invoice?.id ?? null,
          existingInvoiceNumber: result.invoice?.invoiceNumber ?? null,
        },
        409,
      )
    }
    if (result.status === "duplicate_fiscal_invoice") {
      return c.json(
        {
          error: "A fiscal invoice already exists for this booking amount",
          code: "duplicate_fiscal_invoice",
          existingInvoiceId: result.invoice.id,
          existingInvoiceNumber: result.invoice.invoiceNumber,
        },
        409,
      )
    }

    return c.json({ data: result.invoice }, 201)
  })
