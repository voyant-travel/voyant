import { describe, expect, it } from "vitest"

import * as ledger from "../../src/service-action-ledger.js"

describe("finance payment action ledger builders", () => {
  it("builds booking-targeted action ledger input for payment session creation", async () => {
    const ledgerInput = await ledger.buildPaymentSessionCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        session: {
          id: "psess_123",
          targetType: "booking_payment_schedule",
          targetId: "bps_123",
          bookingId: "book_123",
          invoiceId: null,
          orderId: null,
          amountCents: 25000,
          currency: "USD",
          provider: "netopia",
          idempotencyKey: "session-create-123",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_session.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.payment_session.create",
      authorizationSource: "finance.payment_session.route",
      idempotencyScope: "finance.payment_session:booking:book_123:create",
      idempotencyKey: "session-create-123",
      mutationDetail: {
        commandInputRef: "booking:book_123:payment_session",
        commandResultRef: "payment_session:psess_123",
        summary: "Payment session psess_123 created for booking book_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds booking-targeted action ledger input for payment completions", async () => {
    const ledgerInput = await ledger.buildPaymentSessionCompletionActionLedgerInput(
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

  it("builds booking-targeted action ledger input for payment session updates", () => {
    const ledgerInput = ledger.buildPaymentSessionUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        session: {
          id: "psess_123",
          bookingId: "book_123",
          invoiceId: null,
          orderId: null,
          targetType: "booking",
          targetId: "book_123",
        } as never,
        changes: {
          notes: "Retrying payment",
          provider: "netopia",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_session.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.payment_session.update",
      authorizationSource: "finance.payment_session.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "payment_session:psess_123:update",
        commandResultRef: "payment_session:psess_123",
        summary: "Payment session psess_123 updated (notes, provider)",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for failed payment sessions", () => {
    const ledgerInput = ledger.buildPaymentSessionFailedActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        session: {
          id: "psess_123",
          bookingId: "book_123",
          invoiceId: null,
          orderId: null,
          targetType: "booking",
          targetId: "book_123",
        } as never,
        changes: {
          failureCode: "declined",
          failureMessage: "Card declined",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_session.fail",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.payment_session.fail",
      authorizationSource: "finance.payment_session.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "payment_session:psess_123:fail",
        commandResultRef: "payment_session:psess_123",
        summary: "Payment session psess_123 marked as failed",
        reversalKind: "none",
      },
    })
  })

  it("builds person-targeted action ledger input for payment instrument creation", () => {
    const ledgerInput = ledger.buildPaymentInstrumentCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        instrument: {
          id: "pins_123",
          ownerType: "client",
          personId: "person_123",
          organizationId: null,
          supplierId: null,
          channelId: null,
          instrumentType: "card",
          status: "active",
          label: "Visa ending 4242",
          provider: "netopia",
          externalToken: "tok_sensitive",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_instrument.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "person",
      targetId: "person_123",
      routeOrToolName: "finance.payment_instrument.create",
      authorizationSource: "finance.payment_instrument.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "person:person_123:payment_instrument",
        commandResultRef: "payment_instrument:pins_123",
        summary: "Payment instrument pins_123 created for person:person_123",
        reversalKind: "none",
      },
    })
  })

  it("builds organization-targeted action ledger input for payment instrument updates", () => {
    const ledgerInput = ledger.buildPaymentInstrumentUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        instrument: {
          id: "pins_123",
          personId: null,
          organizationId: "org_123",
          supplierId: null,
          channelId: null,
        } as never,
        changes: {
          label: "Corporate card",
          status: "inactive",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_instrument.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "organization",
      targetId: "org_123",
      routeOrToolName: "finance.payment_instrument.update",
      authorizationSource: "finance.payment_instrument.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "payment_instrument:pins_123:update",
        commandResultRef: "payment_instrument:pins_123",
        summary: "Payment instrument pins_123 updated (label, status)",
        reversalKind: "none",
      },
    })
  })

  it("builds instrument-targeted action ledger input for payment instrument deletes", () => {
    const ledgerInput = ledger.buildPaymentInstrumentDeleteActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        instrument: {
          id: "pins_123",
          personId: null,
          organizationId: null,
          supplierId: null,
          channelId: null,
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_instrument.delete",
      actionKind: "delete",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "payment_instrument",
      targetId: "pins_123",
      routeOrToolName: "finance.payment_instrument.delete",
      authorizationSource: "finance.payment_instrument.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "payment_instrument:pins_123:delete",
        commandResultRef: null,
        summary: "Payment instrument pins_123 deleted",
        reversalKind: "none",
      },
    })
  })

  it("builds invoice-targeted action ledger input for payment authorization creation", async () => {
    const ledgerInput = await ledger.buildPaymentAuthorizationCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        authorization: {
          id: "pauth_123",
          bookingId: null,
          orderId: null,
          invoiceId: "inv_123",
          bookingGuaranteeId: null,
          amountCents: 25000,
          currency: "USD",
          provider: "netopia",
          externalAuthorizationId: "auth-ext-123",
          status: "authorized",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_authorization.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "invoice",
      targetId: "inv_123",
      routeOrToolName: "finance.payment_authorization.create",
      authorizationSource: "finance.payment_authorization.route",
      idempotencyScope: "finance.invoice:inv_123:payment_authorization",
      idempotencyKey: "auth-ext-123",
      mutationDetail: {
        commandInputRef: "invoice:inv_123:payment_authorization",
        commandResultRef: "payment_authorization:pauth_123",
        summary: "Payment authorization pauth_123 created for invoice inv_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds invoice-targeted action ledger input for payment authorization updates", () => {
    const ledgerInput = ledger.buildPaymentAuthorizationUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        authorization: {
          id: "pauth_123",
          bookingId: null,
          orderId: null,
          invoiceId: "inv_123",
          bookingGuaranteeId: null,
        } as never,
        changes: {
          approvalCode: "A-123",
          status: "captured",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_authorization.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "invoice",
      targetId: "inv_123",
      routeOrToolName: "finance.payment_authorization.update",
      authorizationSource: "finance.payment_authorization.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "payment_authorization:pauth_123:update",
        commandResultRef: "payment_authorization:pauth_123",
        summary: "Payment authorization pauth_123 updated (approvalCode, status)",
        reversalKind: "none",
      },
    })
  })

  it("builds invoice-targeted action ledger input for payment capture creation", async () => {
    const ledgerInput = await ledger.buildPaymentCaptureCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        capture: {
          id: "pcap_123",
          paymentAuthorizationId: "pauth_123",
          invoiceId: "inv_123",
          amountCents: 25000,
          currency: "USD",
          provider: "netopia",
          externalCaptureId: "cap-ext-123",
          status: "completed",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_capture.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "invoice",
      targetId: "inv_123",
      routeOrToolName: "finance.payment_capture.create",
      authorizationSource: "finance.payment_capture.route",
      idempotencyScope: "finance.invoice:inv_123:payment_capture",
      idempotencyKey: "cap-ext-123",
      mutationDetail: {
        commandInputRef: "invoice:inv_123:payment_capture",
        commandResultRef: "payment_capture:pcap_123",
        summary: "Payment capture pcap_123 created for invoice inv_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds invoice-targeted action ledger input for payment capture deletes", () => {
    const ledgerInput = ledger.buildPaymentCaptureDeleteActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        capture: {
          id: "pcap_123",
          paymentAuthorizationId: "pauth_123",
          invoiceId: "inv_123",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_capture.delete",
      actionKind: "delete",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "invoice",
      targetId: "inv_123",
      routeOrToolName: "finance.payment_capture.delete",
      authorizationSource: "finance.payment_capture.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "payment_capture:pcap_123:delete",
        commandResultRef: null,
        summary: "Payment capture pcap_123 deleted",
        reversalKind: "none",
      },
    })
  })
})
