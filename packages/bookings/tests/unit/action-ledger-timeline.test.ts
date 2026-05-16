import type { ActionLedgerEntry } from "@voyantjs/action-ledger"
import { describe, expect, it } from "vitest"

import { __test__ } from "../../src/routes.js"

const baseDate = new Date("2026-05-15T10:00:00.000Z")

function makeEntry(overrides: Partial<ActionLedgerEntry> = {}): ActionLedgerEntry {
  return {
    id: "alge_1",
    occurredAt: baseDate,
    actionName: "booking.pii.read",
    actionVersion: "v1",
    actionKind: "read",
    status: "succeeded",
    evaluatedRisk: "high",
    actorType: "staff",
    principalType: "user",
    principalId: "usr_1",
    principalSubtype: null,
    sessionId: "sess_1",
    apiTokenId: null,
    internalRequest: false,
    delegatedByPrincipalType: null,
    delegatedByPrincipalId: null,
    delegationId: null,
    callerType: "session",
    organizationId: "org_1",
    routeOrToolName: "bookings.travel-details",
    workflowRunId: null,
    workflowStepId: null,
    correlationId: null,
    causationActionId: null,
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    targetType: "booking_traveler",
    targetId: "bkpt_1",
    capabilityId: null,
    capabilityVersion: null,
    authorizationSource: null,
    approvalId: null,
    amendsActionId: null,
    createdAt: baseDate,
    ...overrides,
  }
}

describe("booking action ledger timeline", () => {
  it("merges booking and traveler entries, dedupes by id, and sorts by cursor order", () => {
    const duplicate = makeEntry({
      id: "alge_duplicate",
      occurredAt: new Date("2026-05-15T10:01:00.000Z"),
      targetType: "booking",
      targetId: "book_1",
    })

    const page = __test__.buildBookingActionLedgerPage({
      bookingEntries: [
        makeEntry({
          id: "alge_old",
          occurredAt: new Date("2026-05-15T09:59:00.000Z"),
          targetType: "booking",
          targetId: "book_1",
        }),
        duplicate,
      ],
      travelerEntries: [
        makeEntry({
          id: "alge_new",
          occurredAt: new Date("2026-05-15T10:02:00.000Z"),
        }),
        makeEntry({
          id: "alge_tie_z",
          occurredAt: new Date("2026-05-15T10:01:00.000Z"),
        }),
        duplicate,
      ],
      limit: 10,
    })

    expect(page.entries.map((entry) => entry.id)).toEqual([
      "alge_new",
      "alge_tie_z",
      "alge_duplicate",
      "alge_old",
    ])
    expect(page.nextCursor).toBeNull()
  })

  it("returns the last visible entry as the next cursor when another merged row exists", () => {
    const page = __test__.buildBookingActionLedgerPage({
      bookingEntries: [
        makeEntry({
          id: "alge_3",
          occurredAt: new Date("2026-05-15T10:03:00.000Z"),
          targetType: "booking",
          targetId: "book_1",
        }),
        makeEntry({
          id: "alge_1",
          occurredAt: new Date("2026-05-15T10:01:00.000Z"),
          targetType: "booking",
          targetId: "book_1",
        }),
      ],
      travelerEntries: [
        makeEntry({
          id: "alge_2",
          occurredAt: new Date("2026-05-15T10:02:00.000Z"),
        }),
      ],
      limit: 2,
    })

    expect(page.entries.map((entry) => entry.id)).toEqual(["alge_3", "alge_2"])
    expect(page.nextCursor).toEqual({
      occurredAt: "2026-05-15T10:02:00.000Z",
      id: "alge_2",
    })
  })

  it("requires both cursor fields and transforms them into the action ledger cursor", () => {
    expect(
      __test__.bookingActionLedgerQuerySchema.safeParse({
        cursorOccurredAt: "2026-05-15T10:02:00.000Z",
      }).success,
    ).toBe(false)

    const result = __test__.bookingActionLedgerQuerySchema.safeParse({
      cursorOccurredAt: "2026-05-15T10:02:00.000Z",
      cursorId: "alge_2",
      limit: "25",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({
      cursor: {
        occurredAt: "2026-05-15T10:02:00.000Z",
        id: "alge_2",
      },
      limit: 25,
    })
  })
})
