import { describe, expect, it } from "vitest"

import {
  buildBookingPaymentSchedulePaidEvent,
  buildCreditNoteCreationActionLedgerInput,
  buildCreditNoteLineItemCreateActionLedgerInput,
  buildCreditNoteUpdateActionLedgerInput,
  buildInvoiceDeleteActionLedgerInput,
  buildInvoiceIssuedActionLedgerInput,
  buildInvoiceLineItemCreateActionLedgerInput,
  buildInvoiceLineItemDeleteActionLedgerInput,
  buildInvoiceLineItemUpdateActionLedgerInput,
  buildInvoiceUpdateActionLedgerInput,
  buildPaymentCompletedEvent,
  buildPaymentSessionCompletionActionLedgerInput,
  buildRecordPaymentActionLedgerInput,
  buildSupplierPaymentCreateActionLedgerInput,
  buildSupplierPaymentUpdateActionLedgerInput,
} from "../../src/service.js"

describe("payment session events", () => {
  it("builds schedule-paid events with booking lifecycle context", () => {
    const session = {
      id: "psess_123",
      provider: "netopia",
      targetType: "booking_payment_schedule",
      targetId: "bps_123",
      bookingId: "book_123",
      orderId: null,
      invoiceId: null,
      bookingPaymentScheduleId: "bps_123",
      bookingGuaranteeId: null,
      amountCents: 25000,
      currency: "USD",
    }
    const schedule = {
      id: "bps_123",
      bookingId: "book_123",
      scheduleType: "deposit",
      amountCents: 25000,
      currency: "USD",
    }

    expect(
      buildBookingPaymentSchedulePaidEvent(schedule as never, session as never, "pay_123"),
    ).toEqual({
      bookingId: "book_123",
      bookingPaymentScheduleId: "bps_123",
      paymentSessionId: "psess_123",
      paymentId: "pay_123",
      scheduleType: "deposit",
      amountCents: 25000,
      currency: "USD",
      provider: "netopia",
    })
  })

  it("includes target metadata on generic payment completion events", () => {
    expect(
      buildPaymentCompletedEvent({
        id: "psess_123",
        targetType: "booking_payment_schedule",
        targetId: "bps_123",
        bookingId: "book_123",
        orderId: null,
        invoiceId: null,
        bookingPaymentScheduleId: "bps_123",
        bookingGuaranteeId: null,
        amountCents: 25000,
        currency: "USD",
        provider: "netopia",
      } as never),
    ).toMatchObject({
      paymentSessionId: "psess_123",
      targetType: "booking_payment_schedule",
      targetId: "bps_123",
      bookingId: "book_123",
      bookingPaymentScheduleId: "bps_123",
      bookingGuaranteeId: null,
      amountCents: 25000,
      currency: "USD",
      provider: "netopia",
    })
  })

  it("builds booking-targeted action ledger input for payment completions", async () => {
    const ledgerInput = await buildPaymentSessionCompletionActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        session: {
          id: "psess_123",
          bookingId: "book_123",
          invoiceId: "inv_123",
          orderId: null,
          providerPaymentId: "provider_payment_123",
          externalReference: null,
          idempotencyKey: null,
        } as never,
        status: "paid",
        paymentId: "pay_123",
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_session.complete",
      actionKind: "execute",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.payment_session.complete",
      authorizationSource: "finance.payment_session.route",
      idempotencyScope: "finance.payment_session:psess_123:complete",
      idempotencyKey: "provider_payment_123",
      mutationDetail: {
        commandInputRef: "payment_session:psess_123:complete",
        commandResultRef: "payment:pay_123",
        summary: "Payment session psess_123 completed as paid",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds booking-targeted action ledger input for manual payment records", async () => {
    const ledgerInput = await buildRecordPaymentActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          bookingId: "book_123",
        } as never,
        payment: {
          id: "pay_123",
          amountCents: 25000,
          currency: "USD",
          paymentMethod: "bank_transfer",
          paymentDate: "2026-05-16",
          referenceNumber: "bank-ref-123",
          paymentAuthorizationId: null,
          paymentCaptureId: null,
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment.record",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.payment.record",
      authorizationSource: "finance.payment.route",
      idempotencyScope: "finance.invoice:inv_123:payment",
      idempotencyKey: "bank-ref-123",
      mutationDetail: {
        commandInputRef: "invoice:inv_123:payment",
        commandResultRef: "payment:pay_123",
        summary: "Payment pay_123 recorded for invoice inv_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds booking-targeted action ledger input for supplier payment creation", async () => {
    const ledgerInput = await buildSupplierPaymentCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        payment: {
          id: "spay_123",
          bookingId: "book_123",
          supplierId: "sup_123",
          amountCents: 25000,
          currency: "USD",
          paymentMethod: "bank_transfer",
          paymentDate: "2026-05-16",
          referenceNumber: "supplier-ref-123",
          status: "completed",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.supplier_payment.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.supplier_payment.create",
      authorizationSource: "finance.supplier_payment.route",
      idempotencyScope: "finance.booking:book_123:supplier_payment",
      idempotencyKey: "supplier-ref-123",
      mutationDetail: {
        commandInputRef: "booking:book_123:supplier_payment",
        commandResultRef: "supplier_payment:spay_123",
        summary: "Supplier payment spay_123 recorded for booking book_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds booking-targeted action ledger input for supplier payment updates", () => {
    const ledgerInput = buildSupplierPaymentUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        payment: {
          id: "spay_123",
          bookingId: "book_123",
        } as never,
        changes: {
          notes: "Settled by bank transfer",
          status: "completed",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.supplier_payment.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.supplier_payment.update",
      authorizationSource: "finance.supplier_payment.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "supplier_payment:spay_123:update",
        commandResultRef: "supplier_payment:spay_123",
        summary: "Supplier payment spay_123 updated (notes, status)",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for credit note creation", async () => {
    const ledgerInput = await buildCreditNoteCreationActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          bookingId: "book_123",
        } as never,
        creditNote: {
          id: "cn_123",
          creditNoteNumber: "CN-2026-001",
          amountCents: 10000,
          currency: "USD",
          status: "issued",
          reason: "Customer refund",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.credit_note.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.credit_note.create",
      authorizationSource: "finance.credit_note.route",
      idempotencyScope: "finance.invoice:inv_123:credit_note",
      idempotencyKey: "CN-2026-001",
      mutationDetail: {
        commandInputRef: "invoice:inv_123:credit_note",
        commandResultRef: "credit_note:cn_123",
        summary: "Credit note CN-2026-001 created for invoice inv_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds booking-targeted action ledger input for credit note updates", () => {
    const ledgerInput = buildCreditNoteUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          bookingId: "book_123",
        } as never,
        creditNote: {
          id: "cn_123",
          creditNoteNumber: "CN-2026-001",
        } as never,
        changes: {
          status: "issued",
          reason: "Customer refund updated",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.credit_note.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.credit_note.update",
      authorizationSource: "finance.credit_note.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "credit_note:cn_123:update",
        commandResultRef: "credit_note:cn_123",
        summary: "Credit note CN-2026-001 updated (reason, status)",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for credit note line item creation", () => {
    const ledgerInput = buildCreditNoteLineItemCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          bookingId: "book_123",
        } as never,
        creditNote: {
          id: "cn_123",
          creditNoteNumber: "CN-2026-001",
        } as never,
        lineItem: {
          id: "cnli_123",
          creditNoteId: "cn_123",
          description: "Refunded tour",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.credit_note_line_item.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.credit_note_line_item.create",
      authorizationSource: "finance.credit_note_line_item.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "credit_note:cn_123:line_item",
        commandResultRef: "credit_note_line_item:cnli_123",
        summary: "Line item cnli_123 added to credit note CN-2026-001",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for invoice issuance", async () => {
    const ledgerInput = await buildInvoiceIssuedActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          invoiceNumber: "INV-2026-001",
          invoiceType: "invoice",
          bookingId: "book_123",
          totalCents: 50000,
          currency: "USD",
          status: "sent",
          issueDate: "2026-05-16",
          dueDate: "2026-05-23",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.invoice.issue_from_booking",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.invoice.issue_from_booking",
      authorizationSource: "finance.invoice.from_booking.route",
      idempotencyScope: "finance.booking:book_123:invoice_issue",
      idempotencyKey: "INV-2026-001",
      mutationDetail: {
        commandInputRef: "booking:book_123:invoice_issue",
        commandResultRef: "invoice:inv_123",
        summary: "Invoice INV-2026-001 issued for booking book_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds booking-targeted action ledger input for invoice updates", () => {
    const ledgerInput = buildInvoiceUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          invoiceNumber: "INV-2026-001",
          bookingId: "book_123",
        } as never,
        changes: {
          dueDate: "2026-06-01",
          notes: "Updated payment terms",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.invoice.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.invoice.update",
      authorizationSource: "finance.invoice.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "invoice:inv_123:update",
        commandResultRef: "invoice:inv_123",
        summary: "Invoice INV-2026-001 updated (dueDate, notes)",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for draft invoice deletion", () => {
    const ledgerInput = buildInvoiceDeleteActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          invoiceNumber: "INV-2026-001",
          bookingId: "book_123",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.invoice.delete",
      actionKind: "delete",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.invoice.delete",
      authorizationSource: "finance.invoice.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "invoice:inv_123:delete",
        commandResultRef: null,
        summary: "Draft invoice INV-2026-001 deleted",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for invoice line item creation", () => {
    const ledgerInput = buildInvoiceLineItemCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          invoiceNumber: "INV-2026-001",
          bookingId: "book_123",
        } as never,
        lineItem: {
          id: "ili_123",
          invoiceId: "inv_123",
          description: "Private tour",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.invoice_line_item.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.invoice_line_item.create",
      authorizationSource: "finance.invoice_line_item.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "invoice:inv_123:line_item",
        commandResultRef: "invoice_line_item:ili_123",
        summary: "Line item ili_123 added to invoice INV-2026-001",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for invoice line item updates", () => {
    const ledgerInput = buildInvoiceLineItemUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          invoiceNumber: "INV-2026-001",
          bookingId: "book_123",
        } as never,
        lineItem: {
          id: "ili_123",
          invoiceId: "inv_123",
          description: "Private tour",
        } as never,
        changes: {
          description: "Private city tour",
          totalCents: 12000,
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.invoice_line_item.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.invoice_line_item.update",
      authorizationSource: "finance.invoice_line_item.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "invoice_line_item:ili_123:update",
        commandResultRef: "invoice_line_item:ili_123",
        summary: "Line item ili_123 updated (description, totalCents)",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for invoice line item deletion", () => {
    const ledgerInput = buildInvoiceLineItemDeleteActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        invoice: {
          id: "inv_123",
          invoiceNumber: "INV-2026-001",
          bookingId: "book_123",
        } as never,
        lineItem: {
          id: "ili_123",
          invoiceId: "inv_123",
          description: "Private tour",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.invoice_line_item.delete",
      actionKind: "delete",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.invoice_line_item.delete",
      authorizationSource: "finance.invoice_line_item.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "invoice_line_item:ili_123:delete",
        commandResultRef: null,
        summary: "Line item ili_123 deleted from invoice INV-2026-001",
        reversalKind: "none",
      },
    })
  })
})
