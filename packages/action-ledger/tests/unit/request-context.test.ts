// agent-quality: file-size exception -- owner: action-ledger; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  ACTION_LEDGER_APPROVAL_ID_HEADER,
  buildActionLedgerApprovalDecisionInput,
  buildActionLedgerApprovalRequestInput,
  buildActionLedgerApprovedExecutionFields,
  buildActionLedgerMutationEntryInput,
  buildActionLedgerSensitiveReadEntryInput,
  decideActionLedgerApproval,
  ledgerSensitiveRead,
  mapActionLedgerRequestContext,
  requestActionLedgerApproval,
} from "../../src/request-context.js"
import { actionLedgerService } from "../../src/service.js"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("mapActionLedgerRequestContext", () => {
  test("maps a staff session to a user principal", () => {
    expect(
      mapActionLedgerRequestContext({
        userId: "usr_1",
        sessionId: "sess_1",
        callerType: "session",
        actor: "staff",
        organizationId: "org_1",
      }),
    ).toEqual({
      actorType: "staff",
      principalType: "user",
      principalId: "usr_1",
      principalSubtype: null,
      sessionId: "sess_1",
      apiTokenId: null,
      internalRequest: false,
      callerType: "session",
      organizationId: "org_1",
      workflowRunId: null,
      workflowStepId: null,
      correlationId: null,
    })
  })

  test("maps an API key to an api_key principal even when a user id is present", () => {
    expect(
      mapActionLedgerRequestContext({
        userId: "usr_operator",
        apiTokenId: "key_1",
        callerType: "api_key",
        actor: "staff",
      }),
    ).toMatchObject({
      actorType: "staff",
      principalType: "api_key",
      principalId: "key_1",
      principalSubtype: null,
      apiTokenId: "key_1",
      callerType: "api_key",
    })
  })

  test("maps an agent request to an agent principal", () => {
    expect(
      mapActionLedgerRequestContext({
        agentId: "agt_1",
        callerType: "agent",
        actor: "agent",
        principalSubtype: "drafting_agent",
        workflowRunId: "wf_run_1",
      }),
    ).toMatchObject({
      actorType: "agent",
      principalType: "agent",
      principalId: "agt_1",
      principalSubtype: "drafting_agent",
      callerType: "agent",
      workflowRunId: "wf_run_1",
    })
  })

  test("maps a workflow request to a workflow principal", () => {
    expect(
      mapActionLedgerRequestContext({
        callerType: "workflow",
        actor: "system",
        workflowRunId: "wf_run_1",
        workflowStepId: "step_1",
      }),
    ).toMatchObject({
      actorType: "system",
      principalType: "workflow",
      principalId: "wf_run_1",
      principalSubtype: null,
      callerType: "workflow",
      workflowRunId: "wf_run_1",
      workflowStepId: "step_1",
    })
  })

  test("maps internal requests to a system principal", () => {
    expect(
      mapActionLedgerRequestContext({
        callerType: "internal",
        isInternalRequest: true,
        workflowRunId: "wf_run_1",
      }),
    ).toMatchObject({
      principalType: "system",
      principalId: "internal_request",
      principalSubtype: null,
      internalRequest: true,
      workflowRunId: "wf_run_1",
    })
  })
})

describe("action ledger route entry builders", () => {
  test("exports the approved execution header contract", () => {
    expect(ACTION_LEDGER_APPROVAL_ID_HEADER).toBe("action-approval-id")
  })

  test("builds sensitive-read entries from request context", () => {
    const entry = buildActionLedgerSensitiveReadEntryInput({
      context: {
        userId: "usr_1",
        sessionId: "sess_1",
        callerType: "session",
        actor: "staff",
      },
      actionName: "booking.pii.read",
      targetType: "booking_traveler",
      targetId: "bkpt_1",
      routeOrToolName: "bookings.travel-details",
      reasonCode: "travel_details_reveal",
      disclosedFieldSet: ["passportNumber"],
      disclosureSummary: "Traveler travel details",
      decisionPolicy: "bookings-pii-scope-or-staff-v1",
    })

    expect(entry).toMatchObject({
      actionName: "booking.pii.read",
      actionVersion: "v1",
      actionKind: "read",
      status: "succeeded",
      evaluatedRisk: "high",
      actorType: "staff",
      principalType: "user",
      principalId: "usr_1",
      sessionId: "sess_1",
      targetType: "booking_traveler",
      targetId: "bkpt_1",
      routeOrToolName: "bookings.travel-details",
      sensitiveReadDetail: {
        reasonCode: "travel_details_reveal",
        disclosedFieldSet: ["passportNumber"],
        disclosureSummary: "Traveler travel details",
        decisionPolicy: "bookings-pii-scope-or-staff-v1",
      },
    })
  })

  test("builds mutation entries that can be appended inside a later transaction", () => {
    const entry = buildActionLedgerMutationEntryInput({
      context: {
        userId: "usr_1",
        callerType: "session",
        actor: "staff",
      },
      actionName: "booking.cancel",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
      causationActionId: "alact_requested_1",
      approvalId: "alap_1",
      payloads: [
        {
          payloadKind: "command_input",
          schemaTag: "booking.cancel:v1",
          retentionPolicy: "audit-default",
          storageRef: "blob://action-ledger/book_1/cancel-input",
        },
      ],
      mutationDetail: {
        summary: "Booking cancelled",
        reversalKind: "domain_command",
        reversalCommandId: "booking.reopen",
        reversalCommandVersion: "v1",
      },
    })

    expect(entry).toMatchObject({
      actionName: "booking.cancel",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "medium",
      principalType: "user",
      principalId: "usr_1",
      targetType: "booking",
      targetId: "book_1",
      causationActionId: "alact_requested_1",
      approvalId: "alap_1",
      payloads: [
        {
          payloadKind: "command_input",
          schemaTag: "booking.cancel:v1",
          retentionPolicy: "audit-default",
          storageRef: "blob://action-ledger/book_1/cancel-input",
        },
      ],
      mutationDetail: {
        summary: "Booking cancelled",
        reversalKind: "domain_command",
      },
    })
  })

  test("builds approval requests from mutation request context", () => {
    const request = buildActionLedgerApprovalRequestInput({
      context: {
        userId: "usr_1",
        sessionId: "sess_1",
        callerType: "session",
        actor: "staff",
      },
      actionName: "booking.cancel",
      actionKind: "update",
      evaluatedRisk: "critical",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.cancel",
      authorizationSource: "capability_registry",
      idempotencyScope: "booking:book_1",
      idempotencyKey: "cancel-request-1",
      mutationDetail: {
        summary: "Booking cancellation requested",
        reversalKind: "domain_command",
        reversalCommandId: "booking.reopen",
        reversalCommandVersion: "v1",
      },
      approval: {
        assignedToPrincipalId: "usr_manager",
        policyName: "booking-cancel-approval",
        policyVersion: "v1",
        targetSnapshotRef: "blob://snapshots/book_1",
        reasonCode: "high_value_booking",
      },
    })

    expect(request).toMatchObject({
      requestedAction: {
        actionName: "booking.cancel",
        actionKind: "update",
        evaluatedRisk: "critical",
        principalType: "user",
        principalId: "usr_1",
        targetType: "booking",
        targetId: "book_1",
        routeOrToolName: "bookings.cancel",
        authorizationSource: "capability_registry",
        idempotencyScope: "booking:book_1",
        idempotencyKey: "cancel-request-1",
        mutationDetail: {
          summary: "Booking cancellation requested",
          reversalKind: "domain_command",
        },
      },
      approval: {
        requestedByPrincipalId: "usr_1",
        assignedToPrincipalId: "usr_manager",
        policyName: "booking-cancel-approval",
        policyVersion: "v1",
        targetSnapshotRef: "blob://snapshots/book_1",
        riskSnapshot: "critical",
        reasonCode: "high_value_booking",
      },
    })
    expect(request.requestedAction).not.toHaveProperty("status")
    expect(request.requestedAction).not.toHaveProperty("approvalId")
  })

  test("builds approval decisions from request context", () => {
    const decision = buildActionLedgerApprovalDecisionInput({
      context: {
        userId: "usr_manager",
        callerType: "session",
        actor: "staff",
        organizationId: "org_1",
        correlationId: "corr_1",
      },
      id: "alap_1",
      status: "approved",
      actionName: "booking.cancel.approve",
      routeOrToolName: "approvals.decide",
      idempotencyScope: "approval:alap_1",
      idempotencyKey: "approve-1",
    })

    expect(decision).toMatchObject({
      id: "alap_1",
      status: "approved",
      decidedByPrincipalId: "usr_manager",
      decidedAt: null,
      decisionAction: {
        actorType: "staff",
        principalType: "user",
        principalId: "usr_manager",
        actionName: "booking.cancel.approve",
        actionVersion: "v1",
        routeOrToolName: "approvals.decide",
        idempotencyScope: "approval:alap_1",
        idempotencyKey: "approve-1",
        organizationId: "org_1",
        correlationId: "corr_1",
      },
    })
  })

  test("builds approved execution ledger fields", () => {
    expect(
      buildActionLedgerApprovedExecutionFields({
        requestedActionId: "alge_requested_1",
        approvalId: "alap_1",
        idempotencyFingerprint: "sha256:approved",
      }),
    ).toEqual({
      causationActionId: "alge_requested_1",
      approvalId: "alap_1",
      idempotencyScope: "alap_1:execution",
      idempotencyKey: "alap_1",
      idempotencyFingerprint: "sha256:approved",
    })
  })
})

describe("ledgerSensitiveRead", () => {
  test("appends the sensitive-read ledger entry before resolving the read value", async () => {
    const events: string[] = []
    const appendSpy = vi.spyOn(actionLedgerService, "appendEntry").mockImplementation(async () => {
      events.push("append")
      return { entry: {} as never, replayed: false }
    })

    const result = await ledgerSensitiveRead(
      {} as AnyDrizzleDb,
      {
        context: {
          userId: "usr_1",
          callerType: "session",
          actor: "staff",
        },
        actionName: "booking.pii.read",
        targetType: "booking_traveler",
        targetId: "bkpt_1",
        routeOrToolName: "bookings.travel-details",
        reasonCode: "travel_details_reveal",
      },
      async () => {
        events.push("read")
        return "secret"
      },
    ).then((value) => {
      events.push("resolved")
      return value
    })

    expect(result).toBe("secret")
    expect(events).toEqual(["append", "read", "resolved"])
    expect(appendSpy).toHaveBeenCalledOnce()
  })

  test("builds the sensitive-read ledger entry from the read value", async () => {
    const appendSpy = vi
      .spyOn(actionLedgerService, "appendEntry")
      .mockResolvedValue({ entry: {} as never, replayed: false })

    const result = await ledgerSensitiveRead(
      {} as AnyDrizzleDb,
      (value: { revealed: boolean }) => ({
        context: {
          userId: "usr_1",
          callerType: "session",
          actor: "staff",
        },
        actionName: "booking.pii.read",
        targetType: "booking_traveler",
        targetId: "bkpt_1",
        routeOrToolName: "bookings.travel-details",
        status: value.revealed ? "succeeded" : "denied",
        reasonCode: value.revealed ? "travel_details_reveal" : "travel_details_not_found",
      }),
      async () => ({ revealed: false }),
    )

    expect(result).toEqual({ revealed: false })
    expect(appendSpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        actionName: "booking.pii.read",
        status: "denied",
        sensitiveReadDetail: expect.objectContaining({
          reasonCode: "travel_details_not_found",
        }),
      }),
    )
  })

  test("rejects without resolving the read value when the ledger append fails", async () => {
    const events: string[] = []
    vi.spyOn(actionLedgerService, "appendEntry").mockImplementation(async () => {
      events.push("append")
      throw new Error("ledger unavailable")
    })

    await expect(
      ledgerSensitiveRead(
        {} as AnyDrizzleDb,
        {
          context: {
            userId: "usr_1",
            callerType: "session",
            actor: "staff",
          },
          actionName: "booking.pii.read",
          targetType: "booking_traveler",
          targetId: "bkpt_1",
          routeOrToolName: "bookings.travel-details",
          reasonCode: "travel_details_reveal",
        },
        async () => {
          events.push("read")
          return "secret"
        },
      ).then((value) => {
        events.push("resolved")
        return value
      }),
    ).rejects.toThrow("ledger unavailable")

    expect(events).toEqual(["append"])
  })
})

describe("approval request-context helpers", () => {
  test("requests approval with the built request input", async () => {
    const requestApprovalSpy = vi
      .spyOn(actionLedgerService, "requestApproval")
      .mockResolvedValue({ requestedAction: {} as never, approval: {} as never, replayed: false })

    await requestActionLedgerApproval({} as AnyDrizzleDb, {
      context: {
        userId: "usr_1",
        callerType: "session",
        actor: "staff",
      },
      actionName: "booking.cancel",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
      approval: {
        policyName: "booking-cancel-approval",
        policyVersion: "v1",
      },
    })

    expect(requestApprovalSpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        requestedAction: expect.objectContaining({
          actionName: "booking.cancel",
          actionKind: "update",
          principalId: "usr_1",
          targetType: "booking",
          targetId: "book_1",
        }),
        approval: expect.objectContaining({
          requestedByPrincipalId: "usr_1",
          policyName: "booking-cancel-approval",
          policyVersion: "v1",
        }),
      }),
    )
  })

  test("decides approval with the built decision input", async () => {
    const decideApprovalSpy = vi
      .spyOn(actionLedgerService, "decideApproval")
      .mockResolvedValue({ approval: {} as never, decisionAction: {} as never })

    await decideActionLedgerApproval({} as AnyDrizzleDb, {
      context: {
        userId: "usr_manager",
        callerType: "session",
        actor: "staff",
      },
      id: "alap_1",
      status: "denied",
      actionName: "booking.cancel.deny",
    })

    expect(decideApprovalSpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "alap_1",
        status: "denied",
        decidedByPrincipalId: "usr_manager",
        decisionAction: expect.objectContaining({
          actionName: "booking.cancel.deny",
          principalId: "usr_manager",
        }),
      }),
    )
  })
})
