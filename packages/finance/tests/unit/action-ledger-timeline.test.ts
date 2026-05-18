import type { ActionLedgerEntry } from "@voyantjs/action-ledger"
import { describe, expect, it } from "vitest"

import { __test__ } from "../../src/routes-action-ledger.js"

const baseDate = new Date("2026-05-15T10:00:00.000Z")

function makeEntry(overrides: Partial<ActionLedgerEntry> = {}): ActionLedgerEntry {
  return {
    id: "alge_1",
    occurredAt: baseDate,
    actionName: "finance.invoice.update",
    actionVersion: "v1",
    actionKind: "update",
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
    routeOrToolName: "finance.invoice.update",
    workflowRunId: null,
    workflowStepId: null,
    correlationId: null,
    causationActionId: null,
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    targetType: "invoice",
    targetId: "inv_1",
    capabilityId: null,
    capabilityVersion: null,
    authorizationSource: null,
    approvalId: null,
    amendsActionId: null,
    createdAt: baseDate,
    ...overrides,
  }
}

describe("finance action ledger timeline", () => {
  it("dedupes entries, sorts by action ledger cursor order, and returns next cursor", () => {
    const duplicate = makeEntry({
      id: "alge_duplicate",
      occurredAt: new Date("2026-05-15T10:02:00.000Z"),
    })

    const page = __test__.buildFinanceActionLedgerPage({
      entries: [
        makeEntry({
          id: "alge_old",
          occurredAt: new Date("2026-05-15T09:59:00.000Z"),
        }),
        duplicate,
        makeEntry({
          id: "alge_new",
          occurredAt: new Date("2026-05-15T10:03:00.000Z"),
        }),
        makeEntry({
          id: "alge_tie_z",
          occurredAt: new Date("2026-05-15T10:02:00.000Z"),
        }),
        duplicate,
      ],
      limit: 2,
    })

    expect(page.data.map((entry) => entry.id)).toEqual(["alge_new", "alge_tie_z"])
    expect(page.pageInfo.nextCursor).toEqual({
      occurredAt: "2026-05-15T10:02:00.000Z",
      id: "alge_tie_z",
    })
  })

  it("requires both cursor fields and transforms them into the action ledger cursor", () => {
    expect(
      __test__.financeActionLedgerQuerySchema.safeParse({
        cursorOccurredAt: "2026-05-15T10:02:00.000Z",
      }).success,
    ).toBe(false)

    const result = __test__.financeActionLedgerQuerySchema.safeParse({
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

  it("resolves payment session ledger target using the same precedence as builders", () => {
    expect(
      __test__.getPaymentSessionLedgerTarget({
        id: "pays_1",
        bookingId: "book_1",
        invoiceId: "inv_1",
        orderId: null,
        targetType: "other",
        targetId: null,
      }),
    ).toEqual({ type: "booking", id: "book_1" })

    expect(
      __test__.getPaymentSessionLedgerTarget({
        id: "pays_1",
        bookingId: null,
        invoiceId: null,
        orderId: null,
        targetType: "checkout_session",
        targetId: "chk_1",
      }),
    ).toEqual({ type: "checkout_session", id: "chk_1" })
  })
})
