import { describe, expect, test } from "vitest"

import { ActionLedgerReversalTargetError, actionLedgerService } from "../../src/service.js"
import { baseDate, makeApproval, makeEntry, makeMutationDetail } from "./service-fixtures.js"
import { makeReversalDb, makeValidateApprovedActionDb } from "./service-query-fixtures.js"

describe("actionLedgerService.recordReversal", () => {
  test("appends a reversal action and updates the original mutation projection", async () => {
    const original = makeEntry({
      id: "alge_original",
      actionName: "booking.status.cancel",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
    })
    const mutationDetail = makeMutationDetail({
      actionId: original.id,
      reversalKind: "domain_command",
      reversalStateProjection: "available",
      reversalCommandId: "booking.status.reopen",
      reversalCommandVersion: "v1",
    })
    const { db, entries, insertedMutationDetails, updatedMutationDetails } = makeReversalDb({
      entry: original,
      mutationDetail,
    })

    const result = await actionLedgerService.recordReversal(db, {
      originalActionId: original.id,
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
          reversalKind: "none",
        },
      },
    })

    expect(result?.replayed).toBe(false)
    expect(entries).toHaveLength(2)
    expect(result?.reversalAction).toMatchObject({
      id: "alge_2",
      actionName: "booking.status.reopen",
      actionKind: "reverse",
      status: "reversed",
      causationActionId: original.id,
    })
    expect(insertedMutationDetails).toEqual([
      expect.objectContaining({
        actionId: "alge_2",
        summary: "Booking cancellation reversed",
        reversesActionId: original.id,
      }),
    ])
    expect(updatedMutationDetails).toEqual([
      expect.objectContaining({
        reversalStateProjection: "completed",
        reversalOutcomeProjection: "full",
        reversedByActionIdProjection: "alge_2",
      }),
    ])
  })

  test("rejects non-reversible mutation details", async () => {
    const original = makeEntry({ id: "alge_original" })
    const { db } = makeReversalDb({
      entry: original,
      mutationDetail: makeMutationDetail({ actionId: original.id, reversalKind: "none" }),
    })

    await expect(
      actionLedgerService.recordReversal(db, {
        originalActionId: original.id,
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
        },
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerReversalTargetError.name,
      actionId: original.id,
      reason: "not_reversible",
    })
  })
})

describe("actionLedgerService.validateApprovedAction", () => {
  test("rejects a missing approval", async () => {
    const { db } = makeValidateApprovedActionDb({})

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: "appr_missing",
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        idempotencyFingerprint: "sha256:approved",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "not_found",
    })
  })

  test("rejects a non-approved approval", async () => {
    const approval = makeApproval({
      id: "appr_pending",
      status: "pending",
    })
    const { db } = makeValidateApprovedActionDb({ approval })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        idempotencyFingerprint: "sha256:approved",
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "not_approved",
      approval,
      status: "pending",
    })
  })

  test("rejects an expired approved approval", async () => {
    const approval = makeApproval({
      id: "appr_expired",
      status: "approved",
      expiresAt: new Date("2026-05-15T09:00:00.000Z"),
    })
    const { db } = makeValidateApprovedActionDb({ approval })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        idempotencyFingerprint: "sha256:approved",
        now: baseDate,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "expired",
      approval,
    })
  })

  test("accepts an approved requested action for the same principal and fingerprint", async () => {
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.status.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "awaiting_approval",
      principalType: "agent",
      principalId: "agent_1",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.cancel",
      approvalId: "appr_1",
      idempotencyFingerprint: "sha256:approved",
    })
    const approval = makeApproval({
      id: "appr_1",
      requestedActionId: requestedAction.id,
      status: "approved",
    })
    const { db, calls } = makeValidateApprovedActionDb({
      approval,
      entry: requestedAction,
    })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        requestedActionKind: "update",
        requestedActionStatus: "awaiting_approval",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        principalType: "agent",
        principalId: "agent_1",
        idempotencyFingerprint: "sha256:approved",
        executionActionKind: "update",
        now: baseDate,
      }),
    ).resolves.toEqual({
      ok: true,
      approval,
      requestedAction,
      idempotencyFingerprint: "sha256:approved",
    })
    expect(calls).toEqual([
      "action_approvals",
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
      "action_ledger_entries:list",
    ])
  })

  const approvedActionDrifts = [
    ["capability/version", { capabilityVersion: "v2" }, {}, "capability_mismatch"],
    ["policy/version", { policyVersion: "v2" }, {}, "policy_mismatch"],
    ["idempotency key", { idempotencyKey: "other-key" }, {}, "idempotency_key_mismatch"],
    ["reason", { reasonCode: "other-reason" }, {}, "reason_mismatch"],
    ["target", { targetId: "book_other" }, {}, "mismatched_action"],
    ["risk", { evaluatedRisk: "critical" }, {}, "risk_mismatch"],
    [
      "assignee/decider",
      {},
      { assignedToPrincipalId: "usr_approver", decidedByPrincipalId: "usr_other" },
      "assignee_mismatch",
    ],
  ] as const

  test.each(
    approvedActionDrifts,
  )("rejects exact approved-action %s drift", async (_label, validationPatch, approvalPatch, reason) => {
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.status.cancel",
      actionVersion: "v1",
      actionKind: "execute",
      status: "awaiting_approval",
      evaluatedRisk: "high",
      principalType: "agent",
      principalId: "agent_1",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings:tool:cancel",
      capabilityId: "bookings:status:cancel",
      capabilityVersion: "v1",
      approvalId: "appr_exact",
      idempotencyKey: "cancel-key",
      idempotencyFingerprint: "sha256:approved",
    })
    const approval = makeApproval({
      id: "appr_exact",
      requestedActionId: requestedAction.id,
      status: "approved",
      requestedByPrincipalId: "agent_1",
      assignedToPrincipalId: "usr_approver",
      decidedByPrincipalId: "usr_approver",
      policyName: "booking-cancel-policy",
      policyVersion: "v1",
      riskSnapshot: "high",
      reasonCode: "duplicate",
      expiresAt: null,
      ...approvalPatch,
    })
    const { db } = makeValidateApprovedActionDb({ approval, entry: requestedAction })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: requestedAction.actionName,
        actionVersion: requestedAction.actionVersion,
        requestedActionKind: "execute",
        requestedActionStatus: "awaiting_approval",
        targetType: requestedAction.targetType,
        targetId: requestedAction.targetId,
        routeOrToolName: requestedAction.routeOrToolName,
        principalType: requestedAction.principalType,
        principalId: requestedAction.principalId,
        requireApprovalProvenance: true,
        capabilityId: requestedAction.capabilityId,
        capabilityVersion: requestedAction.capabilityVersion,
        evaluatedRisk: requestedAction.evaluatedRisk,
        policyName: approval.policyName,
        policyVersion: approval.policyVersion,
        reasonCode: approval.reasonCode,
        idempotencyKey: requestedAction.idempotencyKey,
        idempotencyFingerprint: "sha256:approved",
        executionActionKind: "create",
        ...validationPatch,
      }),
    ).resolves.toMatchObject({ ok: false, reason })
  })

  test("rejects an approved action that was already executed", async () => {
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.status.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "awaiting_approval",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.cancel",
      approvalId: "appr_1",
      idempotencyFingerprint: "sha256:approved",
    })
    const approval = makeApproval({
      id: "appr_1",
      requestedActionId: requestedAction.id,
      status: "approved",
    })
    const execution = makeEntry({
      id: "alge_execution",
      actionName: "booking.status.cancel",
      actionKind: "update",
      status: "succeeded",
      targetType: "booking",
      targetId: "book_1",
      causationActionId: requestedAction.id,
      approvalId: approval.id,
    })
    const { db } = makeValidateApprovedActionDb({
      approval,
      entry: requestedAction,
      existingExecutions: [execution],
    })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        idempotencyFingerprint: "sha256:approved",
        now: baseDate,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "already_executed",
      existingActionId: execution.id,
    })
  })

  test("rejects an approved action that is missing a command fingerprint", async () => {
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.status.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "awaiting_approval",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.cancel",
      approvalId: "appr_1",
      idempotencyFingerprint: null,
    })
    const approval = makeApproval({
      id: "appr_1",
      requestedActionId: requestedAction.id,
      status: "approved",
    })
    const { db } = makeValidateApprovedActionDb({
      approval,
      entry: requestedAction,
      existingExecutions: [
        makeEntry({
          id: "alge_execution",
          actionName: requestedAction.actionName,
          actionKind: "update",
          status: "succeeded",
          targetType: requestedAction.targetType,
          targetId: requestedAction.targetId,
          causationActionId: requestedAction.id,
          approvalId: approval.id,
        }),
      ],
    })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        idempotencyFingerprint: "sha256:approved",
        now: baseDate,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "missing_fingerprint",
      requestedAction,
    })
  })

  test("rejects an approved action when the command fingerprint changes", async () => {
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.status.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "awaiting_approval",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.cancel",
      approvalId: "appr_1",
      idempotencyFingerprint: "sha256:approved",
    })
    const approval = makeApproval({
      id: "appr_1",
      requestedActionId: requestedAction.id,
      status: "approved",
    })
    const { db } = makeValidateApprovedActionDb({
      approval,
      entry: requestedAction,
      existingExecutions: [
        makeEntry({
          id: "alge_execution",
          actionName: requestedAction.actionName,
          actionKind: "update",
          status: "succeeded",
          targetType: requestedAction.targetType,
          targetId: requestedAction.targetId,
          causationActionId: requestedAction.id,
          approvalId: approval.id,
        }),
      ],
    })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        idempotencyFingerprint: "sha256:changed",
        now: baseDate,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "fingerprint_mismatch",
    })
  })

  test("rejects an approved action for a different principal", async () => {
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.status.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "awaiting_approval",
      principalType: "agent",
      principalId: "agent_1",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.cancel",
      approvalId: "appr_1",
      idempotencyFingerprint: "sha256:approved",
    })
    const approval = makeApproval({
      id: "appr_1",
      requestedActionId: requestedAction.id,
      status: "approved",
    })
    const { db } = makeValidateApprovedActionDb({
      approval,
      entry: requestedAction,
      existingExecutions: [
        makeEntry({
          id: "alge_execution",
          actionName: requestedAction.actionName,
          actionKind: "update",
          status: "succeeded",
          targetType: requestedAction.targetType,
          targetId: requestedAction.targetId,
          causationActionId: requestedAction.id,
          approvalId: approval.id,
        }),
      ],
    })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        principalType: "agent",
        principalId: "agent_2",
        idempotencyFingerprint: "sha256:approved",
        now: baseDate,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "principal_mismatch",
      requestedAction,
    })
  })

  test("rejects an approval whose requested action kind or status does not match", async () => {
    const requestedAction = makeEntry({
      id: "alge_requested",
      actionName: "booking.status.cancel",
      actionVersion: "v1",
      actionKind: "read",
      status: "succeeded",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.cancel",
      approvalId: "appr_1",
      idempotencyFingerprint: "sha256:approved",
    })
    const approval = makeApproval({
      id: "appr_1",
      requestedActionId: requestedAction.id,
      status: "approved",
    })
    const { db } = makeValidateApprovedActionDb({
      approval,
      entry: requestedAction,
    })

    await expect(
      actionLedgerService.validateApprovedAction(db, {
        approvalId: approval.id,
        actionName: "booking.status.cancel",
        actionVersion: "v1",
        requestedActionKind: "update",
        requestedActionStatus: "awaiting_approval",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        idempotencyFingerprint: "sha256:approved",
        now: baseDate,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "mismatched_action",
    })
  })
})
