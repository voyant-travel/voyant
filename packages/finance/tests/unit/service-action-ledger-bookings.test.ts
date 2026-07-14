import { describe, expect, it } from "vitest"

import * as ledger from "../../src/service-action-ledger.js"

describe("finance booking create action ledger builders", () => {
  it("builds a succeeded booking.create ledger input", async () => {
    const ledgerInput = await ledger.buildBookingCreateSucceededActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
        actor: "staff",
      },
      {
        booking: {
          id: "book_123",
          bookingNumber: "BK-123",
        } as never,
        command: {
          productId: "prod_123",
          optionId: "popt_123",
          slotId: "slot_123",
          bookingNumber: "BK-123",
          personId: "pers_123",
          organizationId: null,
          pax: 2,
          itemLineCount: 1,
          extraLineCount: 0,
          travelerCount: 2,
          paymentScheduleCount: 1,
          travelCreditRedemptionRequested: false,
          groupMembershipAction: null,
          initialStatus: "draft",
          documentGeneration: {
            contractDocument: false,
            invoiceDocument: false,
            invoiceType: "invoice",
          },
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "booking.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "booking.create",
      authorizationSource: "booking.create.route",
      idempotencyScope: null,
      idempotencyKey: null,
      mutationDetail: {
        commandInputRef: "booking_create:BK-123:input",
        commandResultRef: "booking:book_123",
        summary: "Booking BK-123 created",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds a failed booking.create ledger input for duplicate rejections", async () => {
    const ledgerInput = await ledger.buildBookingCreateRejectedActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
        actor: "staff",
      },
      {
        existingBooking: {
          id: "book_existing",
          bookingNumber: "BK-EXISTING",
          status: "draft",
        },
        reason: "duplicate_booking",
        command: {
          productId: "prod_123",
          optionId: "popt_123",
          slotId: "slot_123",
          bookingNumber: "BK-RETRY",
          personId: "pers_123",
          pax: 2,
          travelerCount: 2,
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "booking.create",
      actionKind: "create",
      status: "failed",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_existing",
      routeOrToolName: "booking.create",
      authorizationSource: "booking.create.route",
      idempotencyScope: null,
      idempotencyKey: null,
      mutationDetail: {
        commandInputRef: "booking_create:BK-RETRY:input",
        commandResultRef: "booking:book_existing",
        summary: "Booking create rejected as duplicate of BK-EXISTING",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })
})
