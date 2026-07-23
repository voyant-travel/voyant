import {
  createToolRegistry,
  type ToolContext,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import {
  type BookingsToolServices,
  bookingsTools,
  RESERVE_BOOKING_HANDLER_POLICY,
  reserveBookingTool,
} from "../src/tools.js"

function ctx(
  services?: Partial<BookingsToolServices>,
  handlerActionPolicy: ToolHandlerActionPolicyContext | null = reserveHandlerContext(),
): ToolContext & { bookings?: BookingsToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    bookings: services as BookingsToolServices | undefined,
    ...(handlerActionPolicy ? { handlerActionPolicy } : {}),
  }
}

function reserveHandlerContext(
  overrides: Partial<ToolHandlerActionPolicyContext> = {},
): ToolHandlerActionPolicyContext {
  return {
    capabilityId: RESERVE_BOOKING_HANDLER_POLICY.capabilityId,
    capabilityVersion: RESERVE_BOOKING_HANDLER_POLICY.capabilityVersion,
    canonicalName: RESERVE_BOOKING_HANDLER_POLICY.canonicalName,
    actionPolicy: {
      ...RESERVE_BOOKING_HANDLER_POLICY.actionPolicy,
      enforcement: "handler",
      invocation: {
        requiredFields: ["confirmed"],
        optionalFields: ["targetId", "idempotencyKey", "idempotencyFingerprint"],
      },
    },
    invocation: { confirmed: true, idempotencyKey: "reserve-b-1002" },
    ...overrides,
  }
}

describe("bookings tools", () => {
  it("registers read tools and the approval-gated cancellation", () => {
    const registry = createToolRegistry()
    registry.registerAll(bookingsTools)
    const list = registry.list()
    expect(list.map((t) => t.name).sort()).toEqual([
      "cancel_booking",
      "get_booking",
      "list_bookings",
      "reserve_booking",
    ])
    for (const t of list.filter(
      (tool) => tool.name !== "cancel_booking" && tool.name !== "reserve_booking",
    )) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["bookings:read"])
    }
    expect(list.find((tool) => tool.name === "cancel_booking")).toMatchObject({
      tier: "destructive",
      requiredScopes: ["bookings:write"],
      riskPolicy: { destructive: true, reversible: false, confirmationRequired: true },
    })
    expect(list.find((tool) => tool.name === "reserve_booking")).toMatchObject({
      capabilityId: "@voyant-travel/bookings#tool.reserve-booking",
      tier: "destructive",
      requiredScopes: ["bookings:write"],
      audience: { source: "grant", allowed: ["staff"] },
      riskPolicy: { destructive: true, reversible: true, confirmationRequired: true },
    })
    expect(reserveBookingTool.actionPolicyEnforcement).toBe("handler")
  })

  it("returns only the immutable reservation reference", async () => {
    const registry = createToolRegistry()
    registry.registerAll(bookingsTools)
    const result = await registry.dispatch(
      "reserve_booking",
      {
        reservation: {
          bookingNumber: "B-1002",
          sellCurrency: "EUR",
          items: [
            {
              title: "Guided tour",
              availabilitySlotId: "slot_1",
            },
          ],
        },
        idempotencyKey: "reserve-b-1002",
      },
      ctx({
        async reserveBooking() {
          return {
            status: "reserved",
            booking: {
              id: "bk_2",
              bookingNumber: "B-1002",
            },
            replayed: false,
          }
        },
      }),
    )

    expect(result).toEqual({
      status: "reserved",
      booking: {
        id: "bk_2",
        bookingNumber: "B-1002",
      },
      replayed: false,
    })
  })

  it("keeps reservation idempotency inside the handler-owned command contract", () => {
    const registry = createToolRegistry()
    registry.register(reserveBookingTool, {
      actionPolicy: {
        id: "booking.reserve",
        capabilityId: "bookings:reserve",
        version: "v1",
        kind: "execute",
        targetType: "booking",
        targetLifecycle: "created",
        createdTarget: {
          commandTargetType: "booking_reservation_command",
          resultReferenceType: "booking",
          durability: "handler-command-claim-v1",
        },
        risk: "high",
        ledger: "required",
        approval: "never",
        reversible: true,
        allowedActorTypes: ["staff"],
      },
    })

    expect(registry.list()[0]?.actionPolicy).toMatchObject({
      id: "booking.reserve",
      capabilityId: "bookings:reserve",
      targetLifecycle: "created",
      createdTarget: {
        commandTargetType: "booking_reservation_command",
        resultReferenceType: "booking",
        durability: "handler-command-claim-v1",
      },
      enforcement: "handler",
      invocation: {
        requiredFields: ["confirmed", "idempotencyKey"],
      },
    })
  })

  it.each([
    ["missing", null],
    [
      "stale",
      reserveHandlerContext({
        actionPolicy: {
          ...reserveHandlerContext().actionPolicy,
          version: "v0",
        },
      }),
    ],
  ])("rejects %s handler policy before service mutation", async (_label, handlerActionPolicy) => {
    let mutations = 0
    const registry = createToolRegistry()
    registry.registerAll(bookingsTools)

    await expect(
      registry.dispatch(
        "reserve_booking",
        {
          reservation: {
            bookingNumber: "B-1002",
            sellCurrency: "EUR",
            items: [{ title: "Guided tour", availabilitySlotId: "slot_1" }],
          },
          idempotencyKey: "reserve-b-1002",
        },
        ctx(
          {
            async reserveBooking() {
              mutations += 1
              return {
                status: "reserved",
                booking: { id: "bk_2", bookingNumber: "B-1002" },
                replayed: false,
              }
            },
          },
          handlerActionPolicy,
        ),
      ),
    ).rejects.toMatchObject({ code: "ACTION_POLICY_REQUIRED" })
    expect(mutations).toBe(0)
  })

  it("rejects a non-staff actor before service mutation", async () => {
    let mutations = 0
    const registry = createToolRegistry()
    registry.registerAll(bookingsTools)
    const customerContext = ctx({
      async reserveBooking() {
        mutations += 1
        return {
          status: "reserved",
          booking: { id: "bk_2", bookingNumber: "B-1002" },
          replayed: false,
        }
      },
    })
    customerContext.actor = "customer"

    await expect(
      registry.dispatch(
        "reserve_booking",
        {
          reservation: {
            bookingNumber: "B-1002",
            sellCurrency: "EUR",
            items: [{ title: "Guided tour", availabilitySlotId: "slot_1" }],
          },
          idempotencyKey: "reserve-b-1002",
        },
        customerContext,
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })
    expect(mutations).toBe(0)
  })

  it("returns a pending approval without executing cancellation", async () => {
    const registry = createToolRegistry()
    registry.registerAll(bookingsTools)
    const result = await registry.dispatch(
      "cancel_booking",
      { id: "bk_1", note: "operator request", idempotencyKey: "cancel-bk-1" },
      ctx({
        async cancelBooking() {
          return {
            status: "approval_required",
            requestedAction: {
              id: "act_1",
              status: "awaiting_approval",
              actionName: "booking.status.cancel",
              targetType: "booking",
              targetId: "bk_1",
            },
            approval: {
              id: "apr_1",
              status: "pending",
              requestedActionId: "act_1",
              policyName: "bookings-status-approval-v1",
              policyVersion: "v1",
              riskSnapshot: "critical",
              reasonCode: "cancel_requested_by_agent",
              expiresAt: null,
              createdAt: "2026-07-15T10:00:00.000Z",
            },
            replayed: false,
          }
        },
      }),
    )
    expect(result).toMatchObject({ status: "approval_required", approval: { id: "apr_1" } })
  })

  it("dispatches through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(bookingsTools)
    const result = await registry.dispatch(
      "get_booking",
      { id: "bk_1" },
      ctx({
        async listBookings() {
          return { data: [] }
        },
        async getBookingById(id) {
          return {
            id,
            bookingNumber: "B-1001",
            status: "draft",
            personId: null,
            organizationId: null,
            sourceType: "manual",
            externalBookingRef: null,
            communicationLanguage: null,
            contactFirstName: null,
            contactLastName: null,
            contactPartyType: null,
            contactTaxId: null,
            contactEmail: null,
            contactPhone: null,
            contactPreferredLanguage: null,
            contactCountry: null,
            contactRegion: null,
            contactCity: null,
            contactAddressLine1: null,
            contactAddressLine2: null,
            contactPostalCode: null,
            sellCurrency: "EUR",
            baseCurrency: null,
            fxRateSetId: null,
            sellAmountCents: null,
            baseSellAmountCents: null,
            costAmountCents: null,
            baseCostAmountCents: null,
            marginPercent: null,
            startDate: null,
            endDate: null,
            pax: null,
            internalNotes: null,
            customerPaymentPolicy: null,
            priceOverride: null,
            customFields: {},
            holdExpiresAt: null,
            confirmedAt: null,
            expiredAt: null,
            cancelledAt: null,
            completedAt: null,
            awaitingPaymentAt: null,
            paidAt: null,
            redeemedAt: null,
            createdAt: "2026-07-15T10:00:00.000Z",
            updatedAt: "2026-07-15T10:00:00.000Z",
          }
        },
      }),
    )
    expect(result).toMatchObject({ id: "bk_1" })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(bookingsTools)
    await expect(registry.dispatch("list_bookings", {}, ctx(undefined))).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
