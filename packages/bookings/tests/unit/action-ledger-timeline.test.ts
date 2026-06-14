import type { ActionLedgerEntry } from "@voyant-travel/action-ledger"
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
      itemEntries: [
        makeEntry({
          id: "alge_item",
          occurredAt: new Date("2026-05-15T10:00:30.000Z"),
          actionName: "booking.item.update",
          targetType: "booking_item",
          targetId: "bkit_1",
        }),
      ],
      limit: 10,
    })

    expect(page.entries.map((entry) => entry.id)).toEqual([
      "alge_new",
      "alge_tie_z",
      "alge_duplicate",
      "alge_item",
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

  it("builds traveler mutation field summaries without exposing values", () => {
    expect(
      __test__.changedBookingTravelerFields(
        {
          firstName: "Ada",
          lastName: "Lovelace",
          documentNumber: "hidden",
          updatedAt: "ignored",
        },
        null,
        null,
      ),
    ).toEqual(["firstName", "lastName"])

    expect(
      __test__.changedBookingTravelerFields(
        { firstName: "Ada", email: "new@example.test" },
        { firstName: "Ada", email: "old@example.test" },
        { firstName: "Ada", email: "new@example.test" },
      ),
    ).toEqual(["email"])

    expect(
      __test__.changedBookingTravelDetailFields({
        documentNumber: "hidden",
        dietaryRequirements: "hidden",
        firstName: "not-a-travel-detail",
      }),
    ).toEqual(["dietaryRequirements", "documentNumber"])

    expect(__test__.bookingMutationSummary("update", ["email"], "booking traveler")).toBe(
      "Updated booking traveler fields: email",
    )

    expect(
      __test__.changedBookingItemFields(
        { title: "Tour", totalSellAmountCents: 120_00, contactEmail: "ignored@example.test" },
        { title: "Tour", totalSellAmountCents: 100_00 },
        { title: "Tour", totalSellAmountCents: 120_00 },
      ),
    ).toEqual(["totalSellAmountCents"])
  })
})
