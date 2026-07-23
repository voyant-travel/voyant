import { buildIdempotencyFingerprint } from "@voyant-travel/action-ledger"
import type { ToolContext } from "@voyant-travel/tools"
import { afterEach, describe, expect, it, vi } from "vitest"

import { voyantToolContextContribution } from "../../src/mcp-runtime.js"
import { bookingsService } from "../../src/service.js"
import type { BookingsToolServices } from "../../src/tools.js"

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
  it("passes authoritative idempotency metadata and returns an immutable reference", async () => {
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
      }),
    ).resolves.toEqual({
      status: "reserved",
      booking: {
        id: "bk_1",
        bookingNumber: "B-1002",
      },
      replayed: false,
    })

    const fingerprint = await buildIdempotencyFingerprint({
      actionName: "booking.reserve",
      actionVersion: "v1",
      targetType: "booking_reservation_command",
      targetId: reservation.bookingNumber,
      commandInput: reservation,
    })
    expect(reserve).toHaveBeenCalledWith(db, reservation, "agent_1", {
      eventBus,
      actionLedgerContext: expect.objectContaining({
        agentId: "agent_1",
        callerType: "agent",
        actor: "staff",
      }),
      actionLedgerAuthorizationSource: "selected_graph_mcp_handler",
      actionLedgerIdempotencyScope: "bookings.reserve_booking:agent_1",
      actionLedgerIdempotencyKey: "reserve-b-1002",
      actionLedgerIdempotencyFingerprint: fingerprint,
      actionLedgerRouteOrToolName: "bookings.reserve_booking",
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
      }),
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
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" })
  })
})
