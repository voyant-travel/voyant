import {
  buildCreatedTargetCommandFingerprint,
  buildCreatedTargetIdempotencyScope,
} from "@voyant-travel/action-ledger"
import type { ToolContext, ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import { afterEach, describe, expect, it, vi } from "vitest"

import { voyantToolContextContribution } from "../../src/mcp-runtime.js"
import { bookingsService } from "../../src/service.js"
import {
  type BookingsToolServices,
  RESERVE_BOOKING_HANDLER_POLICY,
} from "../../src/tools.js"

const db = {} as never
const eventBus = { emit: vi.fn() }
const toolContext: ToolContext = {
  db,
  actor: "staff",
  audience: "staff",
  tenantId: "operator_1",
  resolverScope: { locale: "en", audience: "staff", market: "default", actor: "staff" },
}
const requestValues: Record<string, unknown> = {
  actor: "staff",
  callerType: "agent",
  scopes: ["bookings:write"],
  agentId: "agent_1",
  eventBus,
  isInternalRequest: false,
}
const request = {
  env: {},
  var: requestValues,
  get(key: string) {
    return requestValues[key]
  },
  req: { header: () => null },
}
const reservation = {
  bookingNumber: "B-1002",
  sourceType: "manual" as const,
  sellCurrency: "EUR",
  items: [
    {
      title: "Guided tour",
      itemType: "unit" as const,
      quantity: 1,
      availabilitySlotId: "slot_1",
      allocationType: "unit" as const,
    },
  ],
}
const admitted = {
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
} as const satisfies ToolHandlerActionPolicyContext

afterEach(() => {
  vi.restoreAllMocks()
})

async function bookingTools() {
  const contribution = await voyantToolContextContribution.contribute({
    context: toolContext,
    request,
    resources: {},
  })
  return contribution.bookings as BookingsToolServices
}

describe("reserve_booking MCP runtime", () => {
  it("passes the exact created-command policy fingerprint and returns an immutable reference", async () => {
    const booking = {
      id: "bk_1",
      bookingNumber: reservation.bookingNumber,
      status: "on_hold",
      holdExpiresAt: new Date("2026-07-15T10:30:00.000Z"),
      sellCurrency: "EUR",
      sellAmountCents: 2500,
      pax: 2,
      contactEmail: "traveler@example.com",
      internalNotes: "not exposed",
    }
    const reserve = vi
      .spyOn(bookingsService, "reserveBooking")
      .mockResolvedValue({ status: "ok", booking, replayed: false } as never)

    await expect(
      (await bookingTools()).reserveBooking({
        reservation,
        idempotencyKey: "reserve-b-1002",
      }, admitted),
    ).resolves.toEqual({
      status: "reserved",
      booking: {
        id: "bk_1",
        bookingNumber: "B-1002",
      },
      replayed: false,
    })

    const fingerprint = await buildCreatedTargetCommandFingerprint({
      actionName: "bookings:reserve",
      actionVersion: "v1",
      commandTarget: {
        type: "booking_reservation_command",
        id: reservation.bookingNumber,
      },
      canonicalTargetType: "booking",
      resultReferenceType: "booking",
      commandInput: reservation,
      capabilityId: "bookings:reserve",
      capabilityVersion: "v1",
      evaluatedRisk: "high",
      approvalPolicy: "none",
      approvalReasonCode: null,
    })
    const scope = await buildCreatedTargetIdempotencyScope({
      actionName: "bookings:reserve",
      actionVersion: "v1",
      principalType: "agent",
      principalId: "agent_1",
      organizationId: null,
    })
    expect(reserve).toHaveBeenCalledWith(db, reservation, "agent_1", {
      eventBus,
      actionLedgerContext: expect.objectContaining({
        agentId: "agent_1",
        callerType: "agent",
        actor: "staff",
      }),
      actionLedgerAuthorizationSource: "selected_graph_mcp_handler",
      actionLedgerIdempotencyScope: scope,
      actionLedgerIdempotencyKey: "reserve-b-1002",
      actionLedgerIdempotencyFingerprint: fingerprint,
      actionLedgerRouteOrToolName: "@voyant-travel/bookings#tool.reserve-booking",
      actionLedgerActionName: "bookings:reserve",
      actionLedgerActionVersion: "v1",
      actionLedgerCapabilityId: "bookings:reserve",
      actionLedgerCapabilityVersion: "v1",
    })
  })

  it("maps an idempotency conflict to an invalid-input Tool error", async () => {
    vi.spyOn(bookingsService, "reserveBooking").mockResolvedValue({
      status: "idempotency_conflict",
      existingActionId: "act_existing",
    } as never)

    await expect(
      (await bookingTools()).reserveBooking({
        reservation,
        idempotencyKey: "reserve-b-1002",
      }, admitted),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      meta: { existingActionId: "act_existing" },
    })
  })

  it("fails closed when a replay has no canonical reservation result", async () => {
    vi.spyOn(bookingsService, "reserveBooking").mockResolvedValue({
      status: "reservation_replay_incomplete",
    } as never)

    await expect(
      (await bookingTools()).reserveBooking({
        reservation,
        idempotencyKey: "reserve-b-1002",
      }, admitted),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" })
  })
})
