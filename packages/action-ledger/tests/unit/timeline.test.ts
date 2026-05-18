import { describe, expect, it } from "vitest"
import type { ActionLedgerEntry } from "../../src/schema.js"
import { __test__ } from "../../src/timeline.js"

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

describe("action ledger target timeline helpers", () => {
  it("dedupes entries, sorts by cursor order, attaches summaries, and returns next cursor", () => {
    const duplicate = makeEntry({
      id: "alge_duplicate",
      occurredAt: new Date("2026-05-15T10:02:00.000Z"),
    })

    const page = __test__.buildActionLedgerTargetTimelinePage({
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
      mutationSummariesByActionId: new Map([["alge_new", "Updated invoice fields: status"]]),
    })

    expect(page.data.map((entry) => entry.id)).toEqual(["alge_new", "alge_tie_z"])
    expect(page.data[0]?.mutationSummary).toBe("Updated invoice fields: status")
    expect(page.data[1]?.mutationSummary).toBeNull()
    expect(page.pageInfo.nextCursor).toEqual({
      occurredAt: "2026-05-15T10:02:00.000Z",
      id: "alge_tie_z",
    })
  })

  it("requires both cursor fields and transforms them into an action ledger cursor", () => {
    expect(
      __test__.actionLedgerTargetTimelineQuerySchema.safeParse({
        cursorOccurredAt: "2026-05-15T10:02:00.000Z",
      }).success,
    ).toBe(false)

    const result = __test__.actionLedgerTargetTimelineQuerySchema.safeParse({
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
