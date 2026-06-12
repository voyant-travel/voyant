// agent-quality: file-size exception -- owner: action-ledger; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import type { AnyDrizzleDb } from "@voyantjs/db"
import { Hono } from "hono"
import { afterEach, describe, expect, test, vi } from "vitest"

import { __test__, actionLedgerAdminRoutes } from "../../src/routes.js"
import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionLedgerRelayOutbox,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
} from "../../src/schema.js"
import { ActionApprovalDecisionConflictError, actionLedgerService } from "../../src/service.js"

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
    correlationId: "corr_1",
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

function makeMutationDetail(overrides: Partial<ActionMutationDetail> = {}): ActionMutationDetail {
  return {
    actionId: "alge_1",
    commandInputRef: null,
    commandResultRef: null,
    summary: "Booking status changed from on_hold to confirmed",
    reversalKind: "none",
    reversalCommandId: null,
    reversalCommandVersion: null,
    reversalArgsRef: null,
    reversalStateProjection: null,
    reversalOutcomeProjection: null,
    reversesActionId: null,
    reversedByActionIdProjection: null,
    ...overrides,
  }
}

function makeSensitiveReadDetail(
  overrides: Partial<ActionSensitiveReadDetail> = {},
): ActionSensitiveReadDetail {
  return {
    actionId: "alge_1",
    reasonCode: "travel_details_reveal",
    disclosedFieldSet: ["passportNumber"],
    disclosureSummary: "Travel document details disclosed",
    decisionPolicy: "bookings-pii-scope-or-staff-v1",
    ...overrides,
  }
}

function makePayload(overrides: Partial<ActionLedgerPayload> = {}): ActionLedgerPayload {
  return {
    id: "alpa_1",
    actionId: "alge_1",
    payloadKind: "command_input",
    schemaTag: "booking.status.confirm:v1",
    redactionStatus: "none",
    retentionPolicy: "audit-default",
    storageRef: "blob://action-ledger/alge_1/input",
    hash: "sha256:payload",
    createdAt: baseDate,
    expiresAt: new Date("2026-06-15T10:00:00.000Z"),
    ...overrides,
  }
}

function makeRelayOutbox(
  overrides: Partial<ActionLedgerRelayOutbox> = {},
): ActionLedgerRelayOutbox {
  return {
    id: "alro_1",
    actionId: "alge_1",
    organizationId: "org_1",
    relayStatus: "pending",
    payloadRef: "blob://action-ledger/alge_1",
    attemptCount: 0,
    nextRetryAt: new Date("2026-05-15T10:05:00.000Z"),
    lastError: null,
    createdAt: baseDate,
    processedAt: null,
    ...overrides,
  }
}

function makeApproval(overrides: Partial<ActionApproval> = {}): ActionApproval {
  return {
    id: "appr_1",
    requestedActionId: "alge_requested",
    status: "pending",
    requestedByPrincipalId: "usr_requester",
    assignedToPrincipalId: "usr_approver",
    decidedByPrincipalId: null,
    delegatedFromPrincipalId: null,
    policyName: "booking-cancel-approval",
    policyVersion: "v1",
    targetSnapshotRef: "blob://action-ledger/alge_requested/target",
    riskSnapshot: "high",
    reasonCode: "paid_booking_cancel",
    expiresAt: new Date("2026-05-15T12:00:00.000Z"),
    decidedAt: null,
    createdAt: baseDate,
    ...overrides,
  }
}

function makeDelegation(overrides: Partial<ActionDelegation> = {}): ActionDelegation {
  return {
    id: "adel_1",
    rootPrincipalType: "user",
    rootPrincipalId: "usr_root",
    parentPrincipalType: "user",
    parentPrincipalId: "usr_root",
    childPrincipalType: "agent",
    childPrincipalId: "agent_child",
    grantSource: "travel.agent.run",
    capabilityScopeRef: "capability://bookings/status",
    budgetScopeRef: "budget://travel-agent/run-1",
    expiresAt: new Date("2026-05-15T12:00:00.000Z"),
    createdAt: baseDate,
    ...overrides,
  }
}

function makeApp(db: AnyDrizzleDb) {
  const app = new Hono<{
    Variables: {
      db: AnyDrizzleDb
    }
  }>()

  app.use("*", async (c, next) => {
    c.set("db", db)
    await next()
  })

  return app.route("/", actionLedgerAdminRoutes)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("actionLedgerAdminRoutes", () => {
  test("lists entries with composed filters and cursor pagination", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listEntries").mockResolvedValue({
      entries: [makeEntry()],
      nextCursor: {
        occurredAt: "2026-05-15T10:00:00.000Z",
        id: "alge_1",
      },
    })

    const app = makeApp(db)
    const response = await app.request(
      "/entries?actionName=booking.status.confirm&actionKind=update&actorType=staff&principalType=user&principalId=usr_1&apiTokenId=key_1&sessionId=sess_1&callerType=session&organizationId=org_1&targetType=booking&targetId=book_1&routeOrToolName=bookings.confirm&workflowRunId=wf_run_1&workflowStepId=wf_step_1&correlationId=corr_1&causationActionId=alge_parent&capabilityId=bookings%3Astatus%3Aconfirm&capabilityVersion=v1&authorizationSource=bookings.status.route&approvalId=appr_1&amendsActionId=alge_prior&idempotencyScope=booking&idempotencyKey=idem_1&evaluatedRisk=high,critical&status=succeeded,denied&reversalKind=domain_command,compensate&reversalState=available,requested&reversalOutcome=partial&reversesActionId=alge_original&reversedByActionId=alge_reversal&sensitiveReasonCode=travel_details_reveal&decisionPolicy=bookings-pii-scope-or-staff-v1&occurredAtFrom=2026-05-15T09%3A00%3A00.000Z&occurredAtTo=2026-05-15T10%3A00%3A00.000Z&cursorOccurredAt=2026-05-15T10%3A00%3A00.000Z&cursorId=alge_cursor&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      actionName: "booking.status.confirm",
      actionKind: "update",
      actorType: "staff",
      principalType: "user",
      principalId: "usr_1",
      apiTokenId: "key_1",
      sessionId: "sess_1",
      callerType: "session",
      organizationId: "org_1",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.confirm",
      workflowRunId: "wf_run_1",
      workflowStepId: "wf_step_1",
      correlationId: "corr_1",
      causationActionId: "alge_parent",
      capabilityId: "bookings:status:confirm",
      capabilityVersion: "v1",
      authorizationSource: "bookings.status.route",
      approvalId: "appr_1",
      amendsActionId: "alge_prior",
      idempotencyScope: "booking",
      idempotencyKey: "idem_1",
      evaluatedRisk: ["high", "critical"],
      status: ["succeeded", "denied"],
      reversalKind: ["domain_command", "compensate"],
      reversalState: ["available", "requested"],
      reversalOutcome: ["partial"],
      reversesActionId: "alge_original",
      reversedByActionId: "alge_reversal",
      sensitiveReasonCode: "travel_details_reveal",
      decisionPolicy: "bookings-pii-scope-or-staff-v1",
      occurredAtFrom: new Date("2026-05-15T09:00:00.000Z"),
      occurredAtTo: new Date("2026-05-15T10:00:00.000Z"),
      cursor: {
        occurredAt: "2026-05-15T10:00:00.000Z",
        id: "alge_cursor",
      },
      limit: 25,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "alge_1",
          occurredAt: "2026-05-15T10:00:00.000Z",
          createdAt: "2026-05-15T10:00:00.000Z",
        },
      ],
      pageInfo: {
        nextCursor: {
          occurredAt: "2026-05-15T10:00:00.000Z",
          id: "alge_1",
        },
      },
    })
  })

  test("rejects cursor halves", () => {
    const parsed = __test__.actionLedgerEntryListQuerySchema.safeParse({
      cursorOccurredAt: "2026-05-15T10:00:00.000Z",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["cursorId"])
  })

  test("lists entries with multi-target filters", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listEntries").mockResolvedValue({
      entries: [],
      nextCursor: null,
    })

    const app = makeApp(db)
    const response = await app.request(
      "/entries?targetType=booking_traveler&targetIds=bkpt_1,bkpt_2&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      targetType: "booking_traveler",
      targetIds: ["bkpt_1", "bkpt_2"],
      occurredAtFrom: undefined,
      occurredAtTo: undefined,
      cursor: undefined,
      limit: 25,
    })
    expect(response.status).toBe(200)
  })

  test("rejects mixed single and multi-target filters", () => {
    const parsed = __test__.actionLedgerEntryListQuerySchema.safeParse({
      targetId: "bkpt_1",
      targetIds: "bkpt_2",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["targetIds"])
  })

  test("lists relay outbox rows with health filters and cursor pagination", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listRelayOutbox").mockResolvedValue({
      rows: [makeRelayOutbox()],
      nextCursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "alro_1",
      },
    })

    const app = makeApp(db)
    const response = await app.request(
      "/relay-outbox?actionId=alge_1&organizationId=org_1&relayStatus=pending,failed&dueBefore=2026-05-15T10%3A05%3A00.000Z&createdAtFrom=2026-05-15T09%3A00%3A00.000Z&createdAtTo=2026-05-15T10%3A00%3A00.000Z&processedAtFrom=2026-05-15T10%3A15%3A00.000Z&processedAtTo=2026-05-15T10%3A30%3A00.000Z&cursorCreatedAt=2026-05-15T10%3A00%3A00.000Z&cursorId=alro_cursor&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      actionId: "alge_1",
      organizationId: "org_1",
      relayStatus: ["pending", "failed"],
      dueBefore: new Date("2026-05-15T10:05:00.000Z"),
      createdAtFrom: new Date("2026-05-15T09:00:00.000Z"),
      createdAtTo: new Date("2026-05-15T10:00:00.000Z"),
      processedAtFrom: new Date("2026-05-15T10:15:00.000Z"),
      processedAtTo: new Date("2026-05-15T10:30:00.000Z"),
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "alro_cursor",
      },
      limit: 25,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "alro_1",
          relayStatus: "pending",
          createdAt: "2026-05-15T10:00:00.000Z",
          nextRetryAt: "2026-05-15T10:05:00.000Z",
          processedAt: null,
        },
      ],
      pageInfo: {
        nextCursor: {
          createdAt: "2026-05-15T10:00:00.000Z",
          id: "alro_1",
        },
      },
    })
  })

  test("rejects relay outbox cursor halves", () => {
    const parsed = __test__.actionLedgerRelayOutboxListQuerySchema.safeParse({
      cursorCreatedAt: "2026-05-15T10:00:00.000Z",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["cursorId"])
  })

  test("lists approvals with inbox filters and cursor pagination", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listApprovals").mockResolvedValue({
      approvals: [makeApproval()],
      nextCursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "appr_1",
      },
    })

    const app = makeApp(db)
    const response = await app.request(
      "/approvals?requestedActionId=alge_requested&status=pending,expired&requestedByPrincipalId=usr_requester&assignedToPrincipalId=usr_approver&decidedByPrincipalId=usr_decider&delegatedFromPrincipalId=usr_delegate&policyName=booking-cancel-approval&policyVersion=v1&riskSnapshot=high,critical&reasonCode=paid_booking_cancel&expiresAtFrom=2026-05-15T11%3A00%3A00.000Z&expiresAtTo=2026-05-15T12%3A00%3A00.000Z&decidedAtFrom=2026-05-15T12%3A15%3A00.000Z&decidedAtTo=2026-05-15T12%3A30%3A00.000Z&createdAtFrom=2026-05-15T09%3A00%3A00.000Z&createdAtTo=2026-05-15T10%3A00%3A00.000Z&cursorCreatedAt=2026-05-15T10%3A00%3A00.000Z&cursorId=appr_cursor&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      requestedActionId: "alge_requested",
      status: ["pending", "expired"],
      requestedByPrincipalId: "usr_requester",
      assignedToPrincipalId: "usr_approver",
      decidedByPrincipalId: "usr_decider",
      delegatedFromPrincipalId: "usr_delegate",
      policyName: "booking-cancel-approval",
      policyVersion: "v1",
      riskSnapshot: ["high", "critical"],
      reasonCode: "paid_booking_cancel",
      expiresAtFrom: new Date("2026-05-15T11:00:00.000Z"),
      expiresAtTo: new Date("2026-05-15T12:00:00.000Z"),
      decidedAtFrom: new Date("2026-05-15T12:15:00.000Z"),
      decidedAtTo: new Date("2026-05-15T12:30:00.000Z"),
      createdAtFrom: new Date("2026-05-15T09:00:00.000Z"),
      createdAtTo: new Date("2026-05-15T10:00:00.000Z"),
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "appr_cursor",
      },
      limit: 25,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "appr_1",
          requestedActionId: "alge_requested",
          status: "pending",
          expiresAt: "2026-05-15T12:00:00.000Z",
          decidedAt: null,
          createdAt: "2026-05-15T10:00:00.000Z",
        },
      ],
      pageInfo: {
        nextCursor: {
          createdAt: "2026-05-15T10:00:00.000Z",
          id: "appr_1",
        },
      },
    })
  })

  test("rejects approval cursor halves", () => {
    const parsed = __test__.actionApprovalListQuerySchema.safeParse({
      cursorCreatedAt: "2026-05-15T10:00:00.000Z",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["cursorId"])
  })

  test("requests an approval with a validated requested action body", async () => {
    const db = {} as AnyDrizzleDb
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.cancel",
      actionKind: "update",
      status: "awaiting_approval",
      targetType: "booking",
      targetId: "book_1",
      approvalId: "appr_1",
    })
    const approval = makeApproval({
      id: "appr_1",
      requestedActionId: requestedAction.id,
    })
    const spy = vi.spyOn(actionLedgerService, "requestApproval").mockResolvedValue({
      requestedAction,
      approval,
      replayed: false,
    })

    const app = makeApp(db)
    const response = await app.request("/approvals/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestedAction: {
          actionName: "booking.cancel",
          actionVersion: "v1",
          actionKind: "update",
          evaluatedRisk: "high",
          principalType: "user",
          principalId: "usr_requester",
          internalRequest: false,
          targetType: "booking",
          targetId: "book_1",
          routeOrToolName: "bookings.cancel",
          organizationId: "org_1",
        },
        approval: {
          assignedToPrincipalId: "usr_approver",
          policyName: "booking-cancel-approval",
          policyVersion: "v1",
          targetSnapshotRef: "blob://action-ledger/book_1/cancel-target",
          reasonCode: "paid_booking_cancel",
          expiresAt: "2026-05-15T12:00:00.000Z",
        },
      }),
    })

    expect(spy).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        requestedAction: expect.objectContaining({
          actionName: "booking.cancel",
          actionVersion: "v1",
          actionKind: "update",
          evaluatedRisk: "high",
          principalType: "user",
          principalId: "usr_requester",
          internalRequest: false,
          targetType: "booking",
          targetId: "book_1",
          routeOrToolName: "bookings.cancel",
          organizationId: "org_1",
        }),
        approval: expect.objectContaining({
          assignedToPrincipalId: "usr_approver",
          policyName: "booking-cancel-approval",
          policyVersion: "v1",
          targetSnapshotRef: "blob://action-ledger/book_1/cancel-target",
          riskSnapshot: null,
          reasonCode: "paid_booking_cancel",
          expiresAt: new Date("2026-05-15T12:00:00.000Z"),
        }),
      }),
    )
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        requestedAction: {
          id: "alge_requested",
          status: "awaiting_approval",
          createdAt: "2026-05-15T10:00:00.000Z",
        },
        approval: {
          id: "appr_1",
          status: "pending",
          createdAt: "2026-05-15T10:00:00.000Z",
        },
        replayed: false,
      },
    })
  })

  test("decides an approval and returns the ledgered decision action", async () => {
    const db = {} as AnyDrizzleDb
    const approval = makeApproval({
      id: "appr_1",
      status: "approved",
      decidedByPrincipalId: "usr_decider",
      decidedAt: new Date("2026-05-15T12:30:00.000Z"),
    })
    const decisionAction = makeEntry({
      id: "alge_decision",
      actionName: "action_approval.approve",
      actionKind: "approve",
      status: "approved",
      targetType: "action_approval",
      targetId: approval.id,
      approvalId: approval.id,
    })
    const spy = vi.spyOn(actionLedgerService, "decideApproval").mockResolvedValue({
      approval,
      decisionAction,
    })

    const app = makeApp(db)
    const response = await app.request("/approvals/appr_1/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "approved",
        decidedByPrincipalId: "usr_decider",
        decidedAt: "2026-05-15T12:30:00.000Z",
        decisionAction: {
          actionName: "action_approval.approve",
          actionVersion: "v1",
          principalType: "user",
          principalId: "usr_decider",
          internalRequest: false,
          routeOrToolName: "action-ledger.approvals.decide",
        },
      }),
    })

    expect(spy).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        id: "appr_1",
        status: "approved",
        decidedByPrincipalId: "usr_decider",
        decidedAt: new Date("2026-05-15T12:30:00.000Z"),
        decisionAction: expect.objectContaining({
          actionName: "action_approval.approve",
          actionVersion: "v1",
          principalType: "user",
          principalId: "usr_decider",
          internalRequest: false,
          routeOrToolName: "action-ledger.approvals.decide",
        }),
      }),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        approval: {
          id: "appr_1",
          status: "approved",
          decidedAt: "2026-05-15T12:30:00.000Z",
        },
        decisionAction: {
          id: "alge_decision",
          actionKind: "approve",
          status: "approved",
          targetType: "action_approval",
          targetId: "appr_1",
          createdAt: "2026-05-15T10:00:00.000Z",
        },
      },
    })
  })

  test("maps stale approval decisions to conflict responses", async () => {
    vi.spyOn(actionLedgerService, "decideApproval").mockRejectedValue(
      new ActionApprovalDecisionConflictError("appr_1", "approved"),
    )

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/approvals/appr_1/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "denied",
        decidedByPrincipalId: "usr_decider",
        decisionAction: {
          actionName: "action_approval.deny",
          actionVersion: "v1",
          principalType: "user",
          principalId: "usr_decider",
          internalRequest: false,
        },
      }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Action approval appr_1 is already approved",
      approvalId: "appr_1",
      currentStatus: "approved",
    })
  })

  test("rejects non-terminal approval decision statuses", () => {
    expect(
      __test__.decideActionApprovalBodySchema.safeParse({
        status: "pending",
        decidedByPrincipalId: "usr_decider",
        decisionAction: {
          actionName: "action_approval.pending",
          principalType: "user",
          principalId: "usr_decider",
        },
      }).success,
    ).toBe(false)

    expect(
      __test__.decideActionApprovalBodySchema.safeParse({
        status: "rejected",
        decidedByPrincipalId: "usr_decider",
        decisionAction: {
          actionName: "action_approval.reject",
          principalType: "user",
          principalId: "usr_decider",
        },
      }).success,
    ).toBe(false)
  })

  test("returns not found when deciding a missing approval", async () => {
    vi.spyOn(actionLedgerService, "decideApproval").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/approvals/appr_missing/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "approved",
        decidedByPrincipalId: "usr_decider",
        decisionAction: {
          actionName: "action_approval.approve",
          actionVersion: "v1",
          principalType: "user",
          principalId: "usr_decider",
          internalRequest: false,
        },
      }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action approval not found",
    })
  })

  test("lists delegations with principal and scope filters plus cursor pagination", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listDelegations").mockResolvedValue({
      delegations: [makeDelegation()],
      nextCursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "adel_1",
      },
    })

    const app = makeApp(db)
    const response = await app.request(
      "/delegations?rootPrincipalType=user&rootPrincipalId=usr_root&parentPrincipalType=user&parentPrincipalId=usr_root&childPrincipalType=agent&childPrincipalId=agent_child&grantSource=travel.agent.run&capabilityScopeRef=capability%3A%2F%2Fbookings%2Fstatus&budgetScopeRef=budget%3A%2F%2Ftravel-agent%2Frun-1&expiresAtFrom=2026-05-15T11%3A00%3A00.000Z&expiresAtTo=2026-05-15T12%3A00%3A00.000Z&createdAtFrom=2026-05-15T09%3A00%3A00.000Z&createdAtTo=2026-05-15T10%3A00%3A00.000Z&cursorCreatedAt=2026-05-15T10%3A00%3A00.000Z&cursorId=adel_cursor&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      rootPrincipalType: "user",
      rootPrincipalId: "usr_root",
      parentPrincipalType: "user",
      parentPrincipalId: "usr_root",
      childPrincipalType: "agent",
      childPrincipalId: "agent_child",
      grantSource: "travel.agent.run",
      capabilityScopeRef: "capability://bookings/status",
      budgetScopeRef: "budget://travel-agent/run-1",
      expiresAtFrom: new Date("2026-05-15T11:00:00.000Z"),
      expiresAtTo: new Date("2026-05-15T12:00:00.000Z"),
      createdAtFrom: new Date("2026-05-15T09:00:00.000Z"),
      createdAtTo: new Date("2026-05-15T10:00:00.000Z"),
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "adel_cursor",
      },
      limit: 25,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "adel_1",
          rootPrincipalType: "user",
          rootPrincipalId: "usr_root",
          childPrincipalType: "agent",
          childPrincipalId: "agent_child",
          expiresAt: "2026-05-15T12:00:00.000Z",
          createdAt: "2026-05-15T10:00:00.000Z",
        },
      ],
      pageInfo: {
        nextCursor: {
          createdAt: "2026-05-15T10:00:00.000Z",
          id: "adel_1",
        },
      },
    })
  })

  test("rejects delegation cursor halves", () => {
    const parsed = __test__.actionDelegationListQuerySchema.safeParse({
      cursorCreatedAt: "2026-05-15T10:00:00.000Z",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["cursorId"])
  })

  test("gets one approval with requested action details", async () => {
    const approval = makeApproval({
      id: "appr_detail",
      requestedActionId: "alge_requested",
    })
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "getApproval").mockResolvedValue({
      approval,
      requestedAction: {
        entry: makeEntry({
          id: approval.requestedActionId,
          status: "awaiting_approval",
          approvalId: approval.id,
        }),
        mutationDetail: makeMutationDetail({ actionId: approval.requestedActionId }),
        sensitiveReadDetail: null,
        payloads: [makePayload({ actionId: approval.requestedActionId })],
        relayOutbox: [makeRelayOutbox({ actionId: approval.requestedActionId })],
      },
    })

    const app = makeApp(db)
    const response = await app.request("/approvals/appr_detail")

    expect(spy).toHaveBeenCalledWith(db, "appr_detail")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "appr_detail",
        requestedActionId: "alge_requested",
        createdAt: "2026-05-15T10:00:00.000Z",
        requestedAction: {
          id: "alge_requested",
          status: "awaiting_approval",
          approvalId: "appr_detail",
          occurredAt: "2026-05-15T10:00:00.000Z",
          createdAt: "2026-05-15T10:00:00.000Z",
          mutationDetail: {
            actionId: "alge_requested",
          },
          sensitiveReadDetail: null,
          payloads: [
            {
              actionId: "alge_requested",
              createdAt: "2026-05-15T10:00:00.000Z",
            },
          ],
          relayOutbox: [
            {
              actionId: "alge_requested",
              createdAt: "2026-05-15T10:00:00.000Z",
            },
          ],
        },
      },
    })
  })

  test("returns 404 when an approval is missing", async () => {
    vi.spyOn(actionLedgerService, "getApproval").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/approvals/appr_missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action approval not found",
    })
  })

  test("gets one delegation", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "getDelegation").mockResolvedValue({
      delegation: makeDelegation({ id: "adel_detail" }),
    })

    const app = makeApp(db)
    const response = await app.request("/delegations/adel_detail")

    expect(spy).toHaveBeenCalledWith(db, "adel_detail")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "adel_detail",
        rootPrincipalType: "user",
        childPrincipalType: "agent",
        expiresAt: "2026-05-15T12:00:00.000Z",
        createdAt: "2026-05-15T10:00:00.000Z",
      },
    })
  })

  test("returns 404 when a delegation is missing", async () => {
    vi.spyOn(actionLedgerService, "getDelegation").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/delegations/adel_missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action delegation not found",
    })
  })

  test("gets one entry with profile details", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue({
      entry: makeEntry({
        actionName: "booking.status.confirm",
        actionKind: "update",
        targetType: "booking",
        targetId: "book_1",
      }),
      mutationDetail: makeMutationDetail(),
      sensitiveReadDetail: makeSensitiveReadDetail(),
      payloads: [makePayload()],
      relayOutbox: [makeRelayOutbox()],
    })

    const app = makeApp(db)
    const response = await app.request("/entries/alge_1")

    expect(spy).toHaveBeenCalledWith(db, "alge_1")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "alge_1",
        occurredAt: "2026-05-15T10:00:00.000Z",
        createdAt: "2026-05-15T10:00:00.000Z",
        mutationDetail: {
          actionId: "alge_1",
          summary: "Booking status changed from on_hold to confirmed",
          reversalKind: "none",
        },
        sensitiveReadDetail: {
          actionId: "alge_1",
          reasonCode: "travel_details_reveal",
          disclosedFieldSet: ["passportNumber"],
        },
        payloads: [
          {
            id: "alpa_1",
            createdAt: "2026-05-15T10:00:00.000Z",
            expiresAt: "2026-06-15T10:00:00.000Z",
            storageRef: "blob://action-ledger/alge_1/input",
          },
        ],
        relayOutbox: [
          {
            id: "alro_1",
            relayStatus: "pending",
            createdAt: "2026-05-15T10:00:00.000Z",
            nextRetryAt: "2026-05-15T10:05:00.000Z",
            processedAt: null,
          },
        ],
      },
    })
  })

  test("records a reversal action for an entry", async () => {
    const db = {} as AnyDrizzleDb
    const originalAction = makeEntry({
      id: "alge_original",
      actionName: "booking.status.cancel",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
    })
    const reversalAction = makeEntry({
      id: "alge_reversal",
      actionName: "booking.status.reopen",
      actionKind: "reverse",
      status: "reversed",
      targetType: "booking",
      targetId: "book_1",
      causationActionId: originalAction.id,
    })
    const spy = vi.spyOn(actionLedgerService, "recordReversal").mockResolvedValue({
      originalAction,
      originalMutationDetail: makeMutationDetail({ actionId: originalAction.id }),
      reversalAction,
      replayed: false,
    })

    const app = makeApp(db)
    const response = await app.request("/entries/alge_original/reversals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reversalAction: {
          actionName: "booking.status.reopen",
          actionVersion: "v1",
          actionKind: "reverse",
          status: "reversed",
          evaluatedRisk: "high",
          principalType: "user",
          principalId: "usr_reverser",
          internalRequest: false,
          targetType: "booking",
          targetId: "book_1",
          mutationDetail: {
            summary: "Booking cancellation reversed",
          },
        },
      }),
    })

    expect(spy).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        originalActionId: "alge_original",
        reversalAction: expect.objectContaining({
          actionName: "booking.status.reopen",
          mutationDetail: expect.objectContaining({
            summary: "Booking cancellation reversed",
            reversalKind: "none",
            reversedByActionIdProjection: null,
          }),
        }),
      }),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        originalAction: { id: "alge_original" },
        reversalAction: {
          id: "alge_reversal",
          actionKind: "reverse",
          status: "reversed",
          causationActionId: "alge_original",
        },
        replayed: false,
      },
    })
  })

  test("returns 404 when an entry is missing", async () => {
    vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/entries/alge_missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action ledger entry not found",
    })
  })
})
