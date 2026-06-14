import type { AnyDrizzleDb } from "@voyant-travel/db"
import { afterEach, describe, expect, test, vi } from "vitest"

import { __test__ } from "../../src/routes.js"
import { ActionApprovalDecisionConflictError, actionLedgerService } from "../../src/service.js"
import { makeApp, makeApproval, makeEntry } from "./routes-fixtures.js"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("actionLedgerAdminRoutes", () => {
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
})
