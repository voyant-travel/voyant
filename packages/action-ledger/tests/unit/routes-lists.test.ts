import type { AnyDrizzleDb } from "@voyant-travel/db"
import { afterEach, describe, expect, test, vi } from "vitest"

import { __test__ } from "../../src/routes.js"
import { actionLedgerService } from "../../src/service.js"
import { makeApp, makeApproval, makeEntry } from "./routes-fixtures.js"

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
})
