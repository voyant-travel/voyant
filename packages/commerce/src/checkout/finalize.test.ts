import { bookingsService } from "@voyant-travel/bookings"
import { runCheckoutFinalize } from "@voyant-travel/catalog/booking-engine"
import {
  financeService,
  issueInvoiceFromBooking,
  issueProformaFromBooking,
  settleCoveredBookingPaymentSchedules,
} from "@voyant-travel/finance"
import { beginWorkflowRun } from "@voyant-travel/workflow-runs"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { dispatchCheckoutFinalize } from "./finalize.js"

const mocks = vi.hoisted(() => ({
  confirmBooking: vi.fn(),
  recoverExpiredPaidBooking: vi.fn(),
  issueInvoiceFromBooking: vi.fn(),
  issueProformaFromBooking: vi.fn(),
  convertProformaToInvoice: vi.fn(),
  createPayment: vi.fn(),
  settleCoveredBookingPaymentSchedules: vi.fn(),
  beginWorkflowRun: vi.fn(),
  runCheckoutFinalize: vi.fn(),
}))

vi.mock("@voyant-travel/bookings", () => ({
  bookingsService: {
    confirmBooking: mocks.confirmBooking,
    recoverExpiredPaidBooking: mocks.recoverExpiredPaidBooking,
  },
}))

vi.mock("@voyant-travel/catalog/booking-engine", () => ({
  runCheckoutFinalize: mocks.runCheckoutFinalize,
}))

vi.mock("@voyant-travel/finance", () => ({
  convertProformaToInvoice: mocks.convertProformaToInvoice,
  issueInvoiceFromBooking: mocks.issueInvoiceFromBooking,
  issueProformaFromBooking: mocks.issueProformaFromBooking,
  settleCoveredBookingPaymentSchedules: mocks.settleCoveredBookingPaymentSchedules,
  financeService: {
    createPayment: mocks.createPayment,
  },
}))

vi.mock("@voyant-travel/workflow-runs", () => ({
  beginWorkflowRun: mocks.beginWorkflowRun,
}))

describe("dispatchCheckoutFinalize", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.confirmBooking.mockResolvedValue({ status: "ok" })
    mocks.issueInvoiceFromBooking.mockResolvedValue({ id: "inv_final" })
    mocks.issueProformaFromBooking.mockResolvedValue({ id: "pro_final" })
    mocks.createPayment.mockResolvedValue({ id: "pay_card" })
    mocks.settleCoveredBookingPaymentSchedules.mockResolvedValue([])
    mocks.beginWorkflowRun.mockResolvedValue(createRecorder())
    mocks.runCheckoutFinalize.mockImplementation(async (input, deps) => {
      await deps.confirmBooking(input.bookingId)
      const invoice = await deps.issueInvoice({ bookingId: input.bookingId })
      await deps.linkPaymentToInvoice({
        bookingId: input.bookingId,
        invoiceId: invoice?.invoiceId ?? "inv_final",
        paymentSessionId: input.paymentSessionId ?? null,
      })
      await deps.generateContractPdf?.({ bookingId: input.bookingId, force: true })
    })
  })

  it("links paid card checkout sessions to the final invoice and settles covered schedules", async () => {
    const db = createCheckoutFinalizeDb()
    const eventBus = { emit: vi.fn() }
    const generateContractPdf = vi
      .fn()
      .mockResolvedValue({ contractId: "ctrt_1", attachmentId: "att_1" })

    await dispatchCheckoutFinalize({
      db: db as never,
      eventBus: eventBus as never,
      input: {
        bookingId: "book_card",
        paymentSessionId: "ps_card",
        paymentIntent: "card",
      },
      trigger: "payment.completed",
      correlationId: "ps_card",
      tags: ["bookingId:book_card", "paymentSessionId:ps_card", "paymentIntent:card"],
      generateContractPdf,
    })

    expect(bookingsService.confirmBooking).toHaveBeenCalledWith(db, "book_card", {}, undefined, {
      eventBus,
    })
    expect(issueInvoiceFromBooking).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        bookingId: "book_card",
        invoiceType: "invoice",
      }),
      expect.objectContaining({
        booking: expect.objectContaining({
          id: "book_card",
          bookingNumber: "BK-CARD",
        }),
        items: [
          expect.objectContaining({
            id: "bkit_1",
            title: "Adult ticket",
            totalSellAmountCents: 50000,
          }),
        ],
      }),
      { eventBus },
    )
    expect(financeService.createPayment).toHaveBeenCalledWith(
      db,
      "inv_final",
      expect.objectContaining({
        amountCents: 50000,
        currency: "USD",
        paymentMethod: "credit_card",
        status: "completed",
        referenceNumber: "NETOPIA-PAY-1",
        notes: "Checkout-finalize linkage from session ps_card",
      }),
    )
    expect(db.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ invoiceId: "inv_final" }),
        expect.objectContaining({ paymentId: "pay_card" }),
      ]),
    )
    expect(settleCoveredBookingPaymentSchedules).toHaveBeenCalledWith(db, "book_card")
    expect(generateContractPdf).toHaveBeenCalledWith({
      db,
      eventBus,
      bookingId: "book_card",
      force: true,
    })
    expect(runCheckoutFinalize).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "book_card", paymentSessionId: "ps_card" }),
      expect.any(Object),
      expect.objectContaining({ skipUntil: undefined, seedResults: undefined }),
    )
    expect(beginWorkflowRun).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        workflowName: "checkout-finalize",
        trigger: "payment.completed",
        correlationId: "ps_card",
      }),
    )
  })

  describe("invoice issuance", () => {
    async function runFinalize() {
      const db = createCheckoutFinalizeDb()
      await dispatchCheckoutFinalize({
        db: db as never,
        eventBus: { emit: vi.fn() } as never,
        input: { bookingId: "book_card", paymentSessionId: "ps_card", paymentIntent: "card" },
        trigger: "payment.completed",
        correlationId: "ps_card",
        tags: [],
      })
      return db
    }

    it("always issues the fiscal invoice at finalize (payment has settled)", async () => {
      // Finalize runs on payment.completed. The document flow is decided
      // earlier, at order placement, and only for the deferred bank-transfer
      // path — never here. A fresh finalize always mints the fiscal invoice.
      await runFinalize()

      expect(issueInvoiceFromBooking).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ bookingId: "book_card", invoiceType: "invoice" }),
        expect.any(Object),
        expect.any(Object),
      )
      expect(issueProformaFromBooking).not.toHaveBeenCalled()
    })

    it("converts an existing proforma instead of issuing a fresh invoice", async () => {
      // A bank-transfer checkout in proforma-first mode already minted a
      // proforma; the finalize step converts it to the fiscal invoice
      // rather than issuing a new document.
      mocks.runCheckoutFinalize.mockImplementationOnce(async (input, deps) => {
        await deps.confirmBooking(input.bookingId)
        await deps.issueInvoice({ bookingId: input.bookingId, convertedFromInvoiceId: "pro_1" })
      })
      mocks.convertProformaToInvoice.mockResolvedValue({
        status: "ok",
        invoice: { id: "inv_from_pro" },
      })

      await runFinalize()

      expect(mocks.convertProformaToInvoice).toHaveBeenCalledWith(
        expect.anything(),
        "pro_1",
        {},
        expect.any(Object),
      )
      expect(issueProformaFromBooking).not.toHaveBeenCalled()
      expect(issueInvoiceFromBooking).not.toHaveBeenCalled()
    })
  })
})

function createRecorder() {
  return {
    runId: "wfr_1",
    startStep: vi.fn(),
    completeStep: vi.fn(),
    failStep: vi.fn(),
    recordSkippedStep: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  }
}

function createCheckoutFinalizeDb() {
  const selectRows = [
    [
      {
        id: "book_card",
        bookingNumber: "BK-CARD",
        personId: "person_1",
        organizationId: null,
        sellCurrency: "USD",
        baseCurrency: "USD",
        sellAmountCents: 50000,
        baseSellAmountCents: 50000,
      },
    ],
    [
      {
        id: "bkit_1",
        bookingId: "book_card",
        title: "Adult ticket",
        quantity: 1,
        unitSellAmountCents: 50000,
        totalSellAmountCents: 50000,
      },
    ],
    [
      {
        id: "ps_card",
        bookingId: "book_card",
        invoiceId: null,
        amountCents: 50000,
        currency: "USD",
        paymentMethod: "credit_card",
        paymentInstrumentId: "pmin_1",
        paymentAuthorizationId: "pmaz_1",
        paymentCaptureId: "pmcp_1",
        providerPaymentId: "NETOPIA-PAY-1",
        externalReference: null,
        providerSessionId: "NETOPIA-SESSION-1",
        completedAt: new Date("2026-07-04T12:00:00.000Z"),
      },
    ],
  ]
  const updates: Array<Record<string, unknown>> = []

  function selectResult(rows: unknown[]) {
    const rowResult = [...rows] as Array<unknown> & {
      limit: () => Promise<unknown[]>
      orderBy: () => unknown[]
    }
    rowResult.limit = async () => rows
    rowResult.orderBy = () => rowResult

    const chain = {
      from: () => chain,
      where: () => rowResult,
      orderBy: () => chain,
      limit: async () => rows,
    }
    return chain
  }

  return {
    updates,
    select: () => selectResult(selectRows.shift() ?? []),
    update: () => ({
      set(values: Record<string, unknown>) {
        updates.push(values)
        return {
          where: async () => undefined,
        }
      },
    }),
  }
}
