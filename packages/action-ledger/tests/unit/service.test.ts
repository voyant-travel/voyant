import type { AnyDrizzleDb } from "@voyantjs/db"
import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, test } from "vitest"
import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionLedgerRelayOutbox,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
  NewActionApproval,
  NewActionLedgerEntry,
} from "../../src/schema.js"
import { actionApprovals, actionLedgerEntries, actionMutationDetails } from "../../src/schema.js"
import {
  __test__,
  ActionApprovalDecisionConflictError,
  ActionApprovalDecisionStatusError,
  ActionLedgerIdempotencyConflictError,
  ActionLedgerReversalTargetError,
  type AppendActionLedgerEntryInput,
  actionLedgerService,
  type DecideActionApprovalInput,
} from "../../src/service.js"

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

describe("actionLedgerService.listEntries", () => {
  test("composes action, actor, target, workflow, control, risk, and status filters", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
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
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_entries"."action_name" = $1')
    expect(query.sql).toContain('"action_ledger_entries"."action_kind" = $2')
    expect(query.sql).toContain('"action_ledger_entries"."actor_type" = $3')
    expect(query.sql).toContain('"action_ledger_entries"."principal_type" = $4')
    expect(query.sql).toContain('"action_ledger_entries"."principal_id" = $5')
    expect(query.sql).toContain('"action_ledger_entries"."api_token_id" = $6')
    expect(query.sql).toContain('"action_ledger_entries"."session_id" = $7')
    expect(query.sql).toContain('"action_ledger_entries"."caller_type" = $8')
    expect(query.sql).toContain('"action_ledger_entries"."organization_id" = $9')
    expect(query.sql).toContain('"action_ledger_entries"."target_type" = $10')
    expect(query.sql).toContain('"action_ledger_entries"."target_id" = $11')
    expect(query.sql).toContain('"action_ledger_entries"."route_or_tool_name" = $12')
    expect(query.sql).toContain('"action_ledger_entries"."workflow_run_id" = $13')
    expect(query.sql).toContain('"action_ledger_entries"."workflow_step_id" = $14')
    expect(query.sql).toContain('"action_ledger_entries"."correlation_id" = $15')
    expect(query.sql).toContain('"action_ledger_entries"."causation_action_id" = $16')
    expect(query.sql).toContain('"action_ledger_entries"."capability_id" = $17')
    expect(query.sql).toContain('"action_ledger_entries"."capability_version" = $18')
    expect(query.sql).toContain('"action_ledger_entries"."authorization_source" = $19')
    expect(query.sql).toContain('"action_ledger_entries"."approval_id" = $20')
    expect(query.sql).toContain('"action_ledger_entries"."amends_action_id" = $21')
    expect(query.sql).toContain('"action_ledger_entries"."idempotency_scope" = $22')
    expect(query.sql).toContain('"action_ledger_entries"."idempotency_key" = $23')
    expect(query.sql).toContain('"action_ledger_entries"."evaluated_risk" in ($24, $25)')
    expect(query.sql).toContain('"action_ledger_entries"."status" in ($26, $27)')
    expect(query.params).toEqual([
      "booking.status.confirm",
      "update",
      "staff",
      "user",
      "usr_1",
      "key_1",
      "sess_1",
      "session",
      "org_1",
      "booking",
      "book_1",
      "bookings.confirm",
      "wf_run_1",
      "wf_step_1",
      "corr_1",
      "alge_parent",
      "bookings:status:confirm",
      "v1",
      "bookings.status.route",
      "appr_1",
      "alge_prior",
      "booking",
      "idem_1",
      "high",
      "critical",
      "succeeded",
      "denied",
    ])
  })

  test("composes a multi-target filter", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
      targetType: "booking_traveler",
      targetIds: ["bkpt_1", "bkpt_2"],
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_entries"."target_type" = $1')
    expect(query.sql).toContain('"action_ledger_entries"."target_id" in ($2, $3)')
    expect(query.params).toEqual(["booking_traveler", "bkpt_1", "bkpt_2"])
  })

  test("uses occurred_at plus id as the cursor tie-breaker", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
      cursor: {
        occurredAt: "2026-05-15T10:00:00.000Z",
        id: "alge_cursor",
      },
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_entries"."occurred_at" < $1')
    expect(query.sql).toContain('"action_ledger_entries"."occurred_at" = $2')
    expect(query.sql).toContain('"action_ledger_entries"."id" < $3')
    expect(query.params).toEqual([
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "alge_cursor",
    ])
  })

  test("composes mutation and sensitive-read profile filters", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
      reversalKind: ["domain_command", "compensate"],
      reversalState: ["available", "requested"],
      reversalOutcome: "partial",
      reversesActionId: "alge_original",
      reversedByActionId: "alge_reversal",
      sensitiveReasonCode: "travel_details_reveal",
      decisionPolicy: "bookings-pii-scope-or-staff-v1",
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain("EXISTS")
    expect(query.sql).toContain('"action_mutation_details"')
    expect(query.sql).toContain('"action_sensitive_read_details"')
    expect(query.sql).toContain('"action_mutation_details"."reversal_kind" in ($1, $2)')
    expect(query.sql).toContain('"action_mutation_details"."reversal_state_projection" in ($3, $4)')
    expect(query.sql).toContain('"action_mutation_details"."reversal_outcome_projection" = $5')
    expect(query.sql).toContain('"action_mutation_details"."reverses_action_id" = $6')
    expect(query.sql).toContain('"action_mutation_details"."reversed_by_action_id_projection" = $7')
    expect(query.sql).toContain('"action_sensitive_read_details"."reason_code" = $8')
    expect(query.sql).toContain('"action_sensitive_read_details"."decision_policy" = $9')
    expect(query.params).toEqual([
      "domain_command",
      "compensate",
      "available",
      "requested",
      "partial",
      "alge_original",
      "alge_reversal",
      "travel_details_reveal",
      "bookings-pii-scope-or-staff-v1",
    ])
  })

  test("composes occurred_at time-window filters", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
      occurredAtFrom: "2026-05-15T09:00:00.000Z",
      occurredAtTo: "2026-05-15T10:00:00.000Z",
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_entries"."occurred_at" >= $1')
    expect(query.sql).toContain('"action_ledger_entries"."occurred_at" <= $2')
    expect(query.params).toEqual(["2026-05-15T09:00:00.000Z", "2026-05-15T10:00:00.000Z"])
  })

  test("overfetches by one and returns the last visible row as the next cursor", async () => {
    const rows = [
      makeEntry({ id: "alge_3", occurredAt: new Date("2026-05-15T10:03:00.000Z") }),
      makeEntry({ id: "alge_2", occurredAt: new Date("2026-05-15T10:02:00.000Z") }),
      makeEntry({ id: "alge_1", occurredAt: new Date("2026-05-15T10:01:00.000Z") }),
    ]
    const { db, calls } = makeListDb(rows)

    const result = await actionLedgerService.listEntries(db, { limit: 2 })

    expect(result.entries.map((entry) => entry.id)).toEqual(["alge_3", "alge_2"])
    expect(result.nextCursor).toEqual({
      occurredAt: "2026-05-15T10:02:00.000Z",
      id: "alge_2",
    })
    expect(calls).toEqual([
      { phase: "orderBy", argCount: 2 },
      { phase: "limit", value: 3 },
    ])
  })
})

describe("actionLedgerService.listRelayOutbox", () => {
  test("composes relay status, action, organization, due, and cursor filters", () => {
    const predicate = __test__.buildActionLedgerRelayOutboxPredicate({
      actionId: "alge_1",
      organizationId: "org_1",
      relayStatus: ["pending", "failed"],
      dueBefore: "2026-05-15T10:05:00.000Z",
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "alro_cursor",
      },
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_outbox"."action_id" = $1')
    expect(query.sql).toContain('"action_ledger_outbox"."organization_id" = $2')
    expect(query.sql).toContain('"action_ledger_outbox"."relay_status" in ($3, $4)')
    expect(query.sql).toContain('"action_ledger_outbox"."next_retry_at" <= $5')
    expect(query.sql).toContain('"action_ledger_outbox"."created_at" < $6')
    expect(query.sql).toContain('"action_ledger_outbox"."created_at" = $7')
    expect(query.sql).toContain('"action_ledger_outbox"."id" < $8')
    expect(query.params).toEqual([
      "alge_1",
      "org_1",
      "pending",
      "failed",
      "2026-05-15T10:05:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "alro_cursor",
    ])
  })

  test("composes relay outbox created and processed time-window filters", () => {
    const predicate = __test__.buildActionLedgerRelayOutboxPredicate({
      createdAtFrom: "2026-05-15T09:00:00.000Z",
      createdAtTo: "2026-05-15T10:00:00.000Z",
      processedAtFrom: "2026-05-15T10:15:00.000Z",
      processedAtTo: "2026-05-15T10:30:00.000Z",
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_outbox"."created_at" >= $1')
    expect(query.sql).toContain('"action_ledger_outbox"."created_at" <= $2')
    expect(query.sql).toContain('"action_ledger_outbox"."processed_at" >= $3')
    expect(query.sql).toContain('"action_ledger_outbox"."processed_at" <= $4')
    expect(query.params).toEqual([
      "2026-05-15T09:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:15:00.000Z",
      "2026-05-15T10:30:00.000Z",
    ])
  })

  test("overfetches by one and returns the last visible relay row as the next cursor", async () => {
    const rows = [
      makeRelayOutbox({ id: "alro_3", createdAt: new Date("2026-05-15T10:03:00.000Z") }),
      makeRelayOutbox({ id: "alro_2", createdAt: new Date("2026-05-15T10:02:00.000Z") }),
      makeRelayOutbox({ id: "alro_1", createdAt: new Date("2026-05-15T10:01:00.000Z") }),
    ]
    const { db, calls } = makeRelayOutboxListDb(rows)

    const result = await actionLedgerService.listRelayOutbox(db, { limit: 2 })

    expect(result.rows.map((row) => row.id)).toEqual(["alro_3", "alro_2"])
    expect(result.nextCursor).toEqual({
      createdAt: "2026-05-15T10:02:00.000Z",
      id: "alro_2",
    })
    expect(calls).toEqual([
      { phase: "orderBy", argCount: 2 },
      { phase: "limit", value: 3 },
    ])
  })
})

describe("actionLedgerService.listApprovals", () => {
  test("composes approval inbox filters and cursor pagination", () => {
    const predicate = __test__.buildActionApprovalsPredicate({
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
      expiresAtFrom: "2026-05-15T11:00:00.000Z",
      expiresAtTo: "2026-05-15T12:00:00.000Z",
      decidedAtFrom: "2026-05-15T12:15:00.000Z",
      decidedAtTo: "2026-05-15T12:30:00.000Z",
      createdAtFrom: "2026-05-15T09:00:00.000Z",
      createdAtTo: "2026-05-15T10:00:00.000Z",
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "appr_cursor",
      },
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_approvals"."requested_action_id" = $1')
    expect(query.sql).toContain('"action_approvals"."status" in ($2, $3)')
    expect(query.sql).toContain('"action_approvals"."requested_by_principal_id" = $4')
    expect(query.sql).toContain('"action_approvals"."assigned_to_principal_id" = $5')
    expect(query.sql).toContain('"action_approvals"."decided_by_principal_id" = $6')
    expect(query.sql).toContain('"action_approvals"."delegated_from_principal_id" = $7')
    expect(query.sql).toContain('"action_approvals"."policy_name" = $8')
    expect(query.sql).toContain('"action_approvals"."policy_version" = $9')
    expect(query.sql).toContain('"action_approvals"."risk_snapshot" in ($10, $11)')
    expect(query.sql).toContain('"action_approvals"."reason_code" = $12')
    expect(query.sql).toContain('"action_approvals"."expires_at" >= $13')
    expect(query.sql).toContain('"action_approvals"."expires_at" <= $14')
    expect(query.sql).toContain('"action_approvals"."decided_at" >= $15')
    expect(query.sql).toContain('"action_approvals"."decided_at" <= $16')
    expect(query.sql).toContain('"action_approvals"."created_at" >= $17')
    expect(query.sql).toContain('"action_approvals"."created_at" <= $18')
    expect(query.sql).toContain('"action_approvals"."created_at" < $19')
    expect(query.sql).toContain('"action_approvals"."created_at" = $20')
    expect(query.sql).toContain('"action_approvals"."id" < $21')
    expect(query.params).toEqual([
      "alge_requested",
      "pending",
      "expired",
      "usr_requester",
      "usr_approver",
      "usr_decider",
      "usr_delegate",
      "booking-cancel-approval",
      "v1",
      "high",
      "critical",
      "paid_booking_cancel",
      "2026-05-15T11:00:00.000Z",
      "2026-05-15T12:00:00.000Z",
      "2026-05-15T12:15:00.000Z",
      "2026-05-15T12:30:00.000Z",
      "2026-05-15T09:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "appr_cursor",
    ])
  })

  test("overfetches by one and returns the last visible approval as the next cursor", async () => {
    const rows = [
      makeApproval({ id: "appr_3", createdAt: new Date("2026-05-15T10:03:00.000Z") }),
      makeApproval({ id: "appr_2", createdAt: new Date("2026-05-15T10:02:00.000Z") }),
      makeApproval({ id: "appr_1", createdAt: new Date("2026-05-15T10:01:00.000Z") }),
    ]
    const { db, calls } = makeApprovalListDb(rows)

    const result = await actionLedgerService.listApprovals(db, { limit: 2 })

    expect(result.approvals.map((approval) => approval.id)).toEqual(["appr_3", "appr_2"])
    expect(result.nextCursor).toEqual({
      createdAt: "2026-05-15T10:02:00.000Z",
      id: "appr_2",
    })
    expect(calls).toEqual([
      { phase: "orderBy", argCount: 2 },
      { phase: "limit", value: 3 },
    ])
  })
})

describe("actionLedgerService.listDelegations", () => {
  test("composes delegation principal, scope, time-window, and cursor filters", () => {
    const predicate = __test__.buildActionDelegationsPredicate({
      rootPrincipalType: "user",
      rootPrincipalId: "usr_root",
      parentPrincipalType: "agent",
      parentPrincipalId: "agent_parent",
      childPrincipalType: "workflow",
      childPrincipalId: "wf_child",
      grantSource: "travel.agent.run",
      capabilityScopeRef: "capability://bookings/status",
      budgetScopeRef: "budget://travel-agent/run-1",
      expiresAtFrom: "2026-05-15T11:00:00.000Z",
      expiresAtTo: "2026-05-15T12:00:00.000Z",
      createdAtFrom: "2026-05-15T09:00:00.000Z",
      createdAtTo: "2026-05-15T10:00:00.000Z",
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "adel_cursor",
      },
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_delegations"."root_principal_type" = $1')
    expect(query.sql).toContain('"action_delegations"."root_principal_id" = $2')
    expect(query.sql).toContain('"action_delegations"."parent_principal_type" = $3')
    expect(query.sql).toContain('"action_delegations"."parent_principal_id" = $4')
    expect(query.sql).toContain('"action_delegations"."child_principal_type" = $5')
    expect(query.sql).toContain('"action_delegations"."child_principal_id" = $6')
    expect(query.sql).toContain('"action_delegations"."grant_source" = $7')
    expect(query.sql).toContain('"action_delegations"."capability_scope_ref" = $8')
    expect(query.sql).toContain('"action_delegations"."budget_scope_ref" = $9')
    expect(query.sql).toContain('"action_delegations"."expires_at" >= $10')
    expect(query.sql).toContain('"action_delegations"."expires_at" <= $11')
    expect(query.sql).toContain('"action_delegations"."created_at" >= $12')
    expect(query.sql).toContain('"action_delegations"."created_at" <= $13')
    expect(query.sql).toContain('"action_delegations"."created_at" < $14')
    expect(query.sql).toContain('"action_delegations"."created_at" = $15')
    expect(query.sql).toContain('"action_delegations"."id" < $16')
    expect(query.params).toEqual([
      "user",
      "usr_root",
      "agent",
      "agent_parent",
      "workflow",
      "wf_child",
      "travel.agent.run",
      "capability://bookings/status",
      "budget://travel-agent/run-1",
      "2026-05-15T11:00:00.000Z",
      "2026-05-15T12:00:00.000Z",
      "2026-05-15T09:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "adel_cursor",
    ])
  })

  test("overfetches by one and returns the last visible delegation as the next cursor", async () => {
    const rows = [
      makeDelegation({ id: "adel_3", createdAt: new Date("2026-05-15T10:03:00.000Z") }),
      makeDelegation({ id: "adel_2", createdAt: new Date("2026-05-15T10:02:00.000Z") }),
      makeDelegation({ id: "adel_1", createdAt: new Date("2026-05-15T10:01:00.000Z") }),
    ]
    const { db, calls } = makeDelegationListDb(rows)

    const result = await actionLedgerService.listDelegations(db, { limit: 2 })

    expect(result.delegations.map((delegation) => delegation.id)).toEqual(["adel_3", "adel_2"])
    expect(result.nextCursor).toEqual({
      createdAt: "2026-05-15T10:02:00.000Z",
      id: "adel_2",
    })
    expect(calls).toEqual([
      { phase: "orderBy", argCount: 2 },
      { phase: "limit", value: 3 },
    ])
  })
})

describe("actionLedgerService approval and delegation details", () => {
  test("returns an approval with its requested action details", async () => {
    const approval = makeApproval({
      id: "appr_detail",
      requestedActionId: "alge_requested",
    })
    const entry = makeEntry({
      id: approval.requestedActionId,
      status: "awaiting_approval",
      approvalId: approval.id,
    })
    const mutationDetail = makeMutationDetail({ actionId: entry.id })
    const sensitiveReadDetail = makeSensitiveReadDetail({ actionId: entry.id })
    const payload = makePayload({ actionId: entry.id })
    const relayOutbox = makeRelayOutbox({ actionId: entry.id })
    const { db, calls } = makeGetApprovalDb({
      approval,
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })

    await expect(actionLedgerService.getApproval(db, approval.id)).resolves.toEqual({
      approval,
      requestedAction: {
        entry,
        mutationDetail,
        sensitiveReadDetail,
        payloads: [payload],
        relayOutbox: [relayOutbox],
      },
    })
    expect(calls).toEqual([
      "action_approvals",
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
      "action_ledger_outbox",
    ])
  })

  test("returns null when an approval is missing", async () => {
    const { db, calls } = makeGetApprovalDb({})

    await expect(actionLedgerService.getApproval(db, "appr_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_approvals"])
  })

  test("returns one delegation", async () => {
    const delegation = makeDelegation({ id: "adel_detail" })
    const { db, calls } = makeGetDelegationDb(delegation)

    await expect(actionLedgerService.getDelegation(db, delegation.id)).resolves.toEqual({
      delegation,
    })
    expect(calls).toEqual(["action_delegations"])
  })

  test("returns null when a delegation is missing", async () => {
    const { db, calls } = makeGetDelegationDb(null)

    await expect(actionLedgerService.getDelegation(db, "adel_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_delegations"])
  })
})

describe("actionLedgerService relay outbox lifecycle", () => {
  test("claims due relay outbox rows and maps SQL result rows", async () => {
    const claimed = makeRelayOutbox({
      relayStatus: "processing",
      attemptCount: 1,
      nextRetryAt: new Date("2026-05-15T10:05:00.000Z"),
      lastError: null,
      processedAt: null,
    })
    const { db, queries } = makeRelayOutboxClaimDb([claimed])

    const result = await actionLedgerService.claimRelayOutbox(db, {
      organizationId: "org_1",
      dueAt: "2026-05-15T10:10:00.000Z",
      limit: 10,
    })

    expect(result.rows).toEqual([claimed])
    expect(queries).toHaveLength(1)
  })

  test("marks processing relay outbox rows as succeeded", async () => {
    const processedAt = new Date("2026-05-15T10:15:00.000Z")
    const row = makeRelayOutbox({
      relayStatus: "succeeded",
      nextRetryAt: null,
      lastError: null,
      processedAt,
    })
    const { db, patches } = makeRelayOutboxUpdateDb(row)

    await expect(
      actionLedgerService.markRelayOutboxSucceeded(db, {
        id: row.id,
        processedAt,
      }),
    ).resolves.toEqual(row)
    expect(patches).toEqual([
      {
        relayStatus: "succeeded",
        nextRetryAt: null,
        lastError: null,
        processedAt,
      },
    ])
  })

  test("marks processing relay outbox rows as retryable failures", async () => {
    const nextRetryAt = new Date("2026-05-15T10:20:00.000Z")
    const row = makeRelayOutbox({
      relayStatus: "failed",
      nextRetryAt,
      lastError: "Relay destination returned 503",
      processedAt: null,
    })
    const { db, patches } = makeRelayOutboxUpdateDb(row)

    await expect(
      actionLedgerService.markRelayOutboxFailed(db, {
        id: row.id,
        lastError: "Relay destination returned 503",
        nextRetryAt,
      }),
    ).resolves.toEqual(row)
    expect(patches).toEqual([
      {
        relayStatus: "failed",
        nextRetryAt,
        lastError: "Relay destination returned 503",
        processedAt: null,
      },
    ])
  })

  test("marks processing relay outbox rows as dead-lettered", async () => {
    const processedAt = new Date("2026-05-15T10:25:00.000Z")
    const row = makeRelayOutbox({
      relayStatus: "dead_letter",
      nextRetryAt: null,
      lastError: "Relay destination rejected payload",
      processedAt,
    })
    const { db, patches } = makeRelayOutboxUpdateDb(row)

    await expect(
      actionLedgerService.markRelayOutboxFailed(db, {
        id: row.id,
        lastError: "Relay destination rejected payload",
        deadLetter: true,
        processedAt,
      }),
    ).resolves.toEqual(row)
    expect(patches).toEqual([
      {
        relayStatus: "dead_letter",
        nextRetryAt: null,
        lastError: "Relay destination rejected payload",
        processedAt,
      },
    ])
  })
})

describe("actionLedgerService.getEntry", () => {
  test("returns an entry with mutation and sensitive-read details", async () => {
    const entry = makeEntry({
      id: "alge_detail",
      actionName: "booking.status.confirm",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
    })
    const mutationDetail = makeMutationDetail({ actionId: entry.id })
    const sensitiveReadDetail = makeSensitiveReadDetail({ actionId: entry.id })
    const payload = makePayload({ actionId: entry.id })
    const relayOutbox = makeRelayOutbox({ actionId: entry.id })
    const { db, calls } = makeGetEntryDb({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })

    await expect(actionLedgerService.getEntry(db, entry.id)).resolves.toEqual({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })
    expect(calls).toEqual([
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
      "action_ledger_outbox",
    ])
  })

  test("returns null when an entry is missing", async () => {
    const { db, calls } = makeGetEntryDb({})

    await expect(actionLedgerService.getEntry(db, "alge_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_ledger_entries"])
  })
})

describe("actionLedgerService.appendEntry", () => {
  test("wraps entry detail inserts in a transaction when the db supports it", async () => {
    const { db, transactionCalls } = makeAppendDb()

    await actionLedgerService.appendEntry(db, {
      actionName: "booking.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      principalType: "user",
      principalId: "usr_1",
      internalRequest: false,
      targetType: "booking",
      targetId: "book_1",
      mutationDetail: {
        summary: "Cancelled booking",
        reversalKind: "domain_command",
      },
      payloads: [
        {
          payloadKind: "command_input",
          schemaTag: "booking.cancel:v1",
          retentionPolicy: "audit-default",
          storageRef: "blob://action-ledger/book_1/cancel-input",
        },
      ],
      enqueueRelay: true,
    })

    expect(transactionCalls).toEqual(["begin", "commit"])
  })

  test("inserts payload references and relay markers with the action id", async () => {
    const { db, insertedPayloads, insertedRelayOutbox } = makeAppendDb()

    const result = await actionLedgerService.appendEntry(db, {
      actionName: "booking.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      principalType: "user",
      principalId: "usr_1",
      internalRequest: false,
      organizationId: "org_1",
      targetType: "booking",
      targetId: "book_1",
      payloads: [
        {
          payloadKind: "command_input",
          schemaTag: "booking.cancel:v1",
          retentionPolicy: "audit-default",
          storageRef: "blob://action-ledger/book_1/cancel-input",
          hash: "sha256:payload",
        },
      ],
      enqueueRelay: { payloadRef: "blob://action-ledger/book_1" },
    })

    expect(result.replayed).toBe(false)
    expect(insertedPayloads).toEqual([
      expect.objectContaining({
        actionId: result.entry.id,
        payloadKind: "command_input",
        schemaTag: "booking.cancel:v1",
        retentionPolicy: "audit-default",
        storageRef: "blob://action-ledger/book_1/cancel-input",
        hash: "sha256:payload",
      }),
    ])
    expect(insertedRelayOutbox).toEqual([
      expect.objectContaining({
        actionId: result.entry.id,
        organizationId: "org_1",
        payloadRef: "blob://action-ledger/book_1",
        relayStatus: "pending",
      }),
    ])
  })

  test("throws a conflict when an idempotency key is replayed with a different fingerprint", async () => {
    const { db } = makeAppendDb()
    const input: AppendActionLedgerEntryInput = {
      actionName: "booking.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "medium",
      principalType: "user",
      principalId: "usr_1",
      internalRequest: false,
      targetType: "booking",
      targetId: "book_1",
      idempotencyScope: "booking",
      idempotencyKey: "idem_1",
      idempotencyFingerprint: "sha256:first",
    }

    await actionLedgerService.appendEntry(db, input)

    await expect(
      actionLedgerService.appendEntry(db, {
        ...input,
        idempotencyFingerprint: "sha256:second",
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerIdempotencyConflictError.name,
      existingActionId: "alge_1",
    })
  })
})

describe("actionLedgerService approval lifecycle", () => {
  test("creates an awaiting-approval requested action with a linked pending approval", async () => {
    const { db, entries, approvals, transactionCalls } = makeApprovalLifecycleDb()

    const result = await actionLedgerService.requestApproval(db, {
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
      },
      approval: {
        assignedToPrincipalId: "usr_approver",
        policyName: "booking-cancel-approval",
        policyVersion: "v1",
        targetSnapshotRef: "blob://action-ledger/book_1/cancel-target",
        reasonCode: "paid_booking_cancel",
        expiresAt: "2026-05-15T12:00:00.000Z",
      },
    })

    expect(transactionCalls).toHaveLength(1)
    expect(entries).toHaveLength(1)
    expect(approvals).toHaveLength(1)
    expect(result.replayed).toBe(false)
    expect(result.requestedAction).toMatchObject({
      id: "alge_1",
      actionName: "booking.cancel",
      status: "awaiting_approval",
      approvalId: result.approval.id,
      principalId: "usr_requester",
      evaluatedRisk: "high",
    })
    expect(result.approval).toMatchObject({
      requestedActionId: "alge_1",
      status: "pending",
      requestedByPrincipalId: "usr_requester",
      assignedToPrincipalId: "usr_approver",
      policyName: "booking-cancel-approval",
      policyVersion: "v1",
      targetSnapshotRef: "blob://action-ledger/book_1/cancel-target",
      riskSnapshot: "high",
      reasonCode: "paid_booking_cancel",
      expiresAt: new Date("2026-05-15T12:00:00.000Z"),
    })
  })

  test("returns an existing approval when an idempotent approval request is replayed", async () => {
    const existingEntry = makeEntry({
      id: "alge_existing",
      actionName: "booking.cancel",
      actionKind: "update",
      status: "awaiting_approval",
      targetType: "booking",
      targetId: "book_1",
      approvalId: "appr_existing",
      idempotencyScope: "booking",
      idempotencyKey: "idem_1",
      idempotencyFingerprint: "sha256:first",
    })
    const existingApproval = makeApproval({
      id: "appr_existing",
      requestedActionId: existingEntry.id,
    })
    const { db, entries, approvals } = makeApprovalLifecycleDb({
      entries: [existingEntry],
      approvals: [existingApproval],
    })

    const result = await actionLedgerService.requestApproval(db, {
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
        idempotencyScope: "booking",
        idempotencyKey: "idem_1",
        idempotencyFingerprint: "sha256:first",
      },
      approval: {
        policyName: "booking-cancel-approval",
        policyVersion: "v1",
      },
    })

    expect(result).toEqual({
      requestedAction: existingEntry,
      approval: existingApproval,
      replayed: true,
    })
    expect(entries).toHaveLength(1)
    expect(approvals).toHaveLength(1)
  })

  test("uses the replayed requested action approval id when recovering a missing approval", async () => {
    const existingEntry = makeEntry({
      id: "alge_existing",
      actionName: "booking.cancel",
      actionKind: "update",
      status: "awaiting_approval",
      targetType: "booking",
      targetId: "book_1",
      approvalId: "appr_recovered",
      idempotencyScope: "booking",
      idempotencyKey: "idem_1",
      idempotencyFingerprint: "sha256:first",
    })
    const { db, entries, approvals } = makeApprovalLifecycleDb({
      entries: [existingEntry],
    })

    const result = await actionLedgerService.requestApproval(db, {
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
        idempotencyScope: "booking",
        idempotencyKey: "idem_1",
        idempotencyFingerprint: "sha256:first",
      },
      approval: {
        policyName: "booking-cancel-approval",
        policyVersion: "v1",
      },
    })

    expect(result.replayed).toBe(true)
    expect(result.requestedAction).toBe(existingEntry)
    expect(result.approval).toMatchObject({
      id: "appr_recovered",
      requestedActionId: existingEntry.id,
      status: "pending",
    })
    expect(entries).toHaveLength(1)
    expect(approvals).toHaveLength(1)
    expect(approvals[0]?.id).toBe(existingEntry.approvalId)
  })

  test("decides a pending approval and appends a decision action", async () => {
    const decidedAt = new Date("2026-05-15T12:30:00.000Z")
    const pendingApproval = makeApproval({
      id: "appr_pending",
      requestedActionId: "alge_requested",
      status: "pending",
    })
    const { db, entries, approvals } = makeApprovalLifecycleDb({
      approvals: [pendingApproval],
    })

    const result = await actionLedgerService.decideApproval(db, {
      id: pendingApproval.id,
      status: "approved",
      decidedByPrincipalId: "usr_decider",
      decidedAt,
      decisionAction: {
        actionName: "action_approval.approve",
        actionVersion: "v1",
        principalType: "user",
        principalId: "usr_decider",
        internalRequest: false,
      },
    })

    expect(result?.approval).toMatchObject({
      id: pendingApproval.id,
      status: "approved",
      decidedByPrincipalId: "usr_decider",
      decidedAt,
    })
    expect(approvals[0]).toMatchObject({
      status: "approved",
      decidedByPrincipalId: "usr_decider",
    })
    expect(entries).toHaveLength(1)
    expect(result?.decisionAction).toMatchObject({
      actionName: "action_approval.approve",
      actionKind: "approve",
      status: "approved",
      evaluatedRisk: "high",
      principalId: "usr_decider",
      targetType: "action_approval",
      targetId: pendingApproval.id,
      causationActionId: pendingApproval.requestedActionId,
      approvalId: pendingApproval.id,
    })
  })

  test("throws a decision conflict when an approval is no longer pending", async () => {
    const { db } = makeApprovalLifecycleDb({
      approvals: [makeApproval({ id: "appr_done", status: "approved" })],
    })

    await expect(
      actionLedgerService.decideApproval(db, {
        id: "appr_done",
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
    ).rejects.toMatchObject({
      name: ActionApprovalDecisionConflictError.name,
      approvalId: "appr_done",
      currentStatus: "approved",
    })
  })

  test("rejects non-terminal decision statuses before writing", async () => {
    const pendingApproval = makeApproval({
      id: "appr_pending",
      requestedActionId: "alge_requested",
      status: "pending",
    })
    const { db, entries, approvals } = makeApprovalLifecycleDb({
      approvals: [pendingApproval],
    })

    const input = {
      id: pendingApproval.id,
      status: "pending",
      decidedByPrincipalId: "usr_decider",
      decisionAction: {
        actionName: "action_approval.pending",
        actionVersion: "v1",
        principalType: "user",
        principalId: "usr_decider",
        internalRequest: false,
      },
    } as unknown as DecideActionApprovalInput

    await expect(actionLedgerService.decideApproval(db, input)).rejects.toMatchObject({
      name: ActionApprovalDecisionStatusError.name,
      status: "pending",
    })
    expect(approvals[0]?.status).toBe("pending")
    expect(entries).toHaveLength(0)
  })
})

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
      "action_ledger_outbox",
      "action_ledger_entries:list",
    ])
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
    expiresAt: null,
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
    nextRetryAt: null,
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

function makeGetEntryDb(input: {
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
  payloads?: ActionLedgerPayload[]
  relayOutbox?: ActionLedgerRelayOutbox[]
}) {
  const calls: string[] = []
  const selectRows = [
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
    input.payloads ?? [],
    input.relayOutbox ?? [],
  ]
  const callLabels = [
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
    "action_ledger_payloads",
    "action_ledger_outbox",
  ]
  let selectIndex = 0

  const db = {
    select() {
      const index = selectIndex
      selectIndex += 1
      return {
        from() {
          return {
            where() {
              if (index >= 3) {
                calls.push(callLabels[index] ?? `select_${index}`)
                return Promise.resolve(selectRows[index] ?? [])
              }

              return {
                limit() {
                  calls.push(callLabels[index] ?? `select_${index}`)
                  return Promise.resolve(selectRows[index] ?? [])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeReversalDb(input: { entry: ActionLedgerEntry; mutationDetail: ActionMutationDetail }) {
  const entries = [input.entry]
  const insertedMutationDetails: unknown[] = []
  const updatedMutationDetails: unknown[] = []
  const selectRows = [[input.entry], [input.mutationDetail], [], [], []]
  let selectIndex = 0

  const db = {
    transaction<T>(callback: (tx: AnyDrizzleDb) => Promise<T>) {
      return callback(db as AnyDrizzleDb)
    },
    select() {
      const index = selectIndex
      selectIndex += 1
      return {
        from() {
          return {
            where() {
              if (index >= 3) {
                return Promise.resolve(selectRows[index] ?? [])
              }
              return {
                limit() {
                  return Promise.resolve(selectRows[index] ?? [])
                },
              }
            },
          }
        },
      }
    },
    insert(table: unknown) {
      return {
        values(values: NewActionLedgerEntry | Record<string, unknown>) {
          if (table === actionMutationDetails) {
            insertedMutationDetails.push(values)
            return {}
          }

          return {
            returning() {
              const entryValues = values as NewActionLedgerEntry
              const entry = makeEntry({
                ...entryValues,
                id: `alge_${entries.length + 1}`,
                occurredAt: entryValues.occurredAt ?? baseDate,
                createdAt: entryValues.createdAt ?? baseDate,
                actorType: entryValues.actorType ?? null,
                principalSubtype: entryValues.principalSubtype ?? null,
                sessionId: entryValues.sessionId ?? null,
                apiTokenId: entryValues.apiTokenId ?? null,
                delegatedByPrincipalType: entryValues.delegatedByPrincipalType ?? null,
                delegatedByPrincipalId: entryValues.delegatedByPrincipalId ?? null,
                delegationId: entryValues.delegationId ?? null,
                callerType: entryValues.callerType ?? null,
                organizationId: entryValues.organizationId ?? null,
                routeOrToolName: entryValues.routeOrToolName ?? null,
                workflowRunId: entryValues.workflowRunId ?? null,
                workflowStepId: entryValues.workflowStepId ?? null,
                correlationId: entryValues.correlationId ?? null,
                causationActionId: entryValues.causationActionId ?? null,
                idempotencyScope: entryValues.idempotencyScope ?? null,
                idempotencyKey: entryValues.idempotencyKey ?? null,
                idempotencyFingerprint: entryValues.idempotencyFingerprint ?? null,
                capabilityId: entryValues.capabilityId ?? null,
                capabilityVersion: entryValues.capabilityVersion ?? null,
                authorizationSource: entryValues.authorizationSource ?? null,
                approvalId: entryValues.approvalId ?? null,
                amendsActionId: entryValues.amendsActionId ?? null,
              })
              entries.push(entry)
              return Promise.resolve([entry])
            },
          }
        },
      }
    },
    update(table: unknown) {
      return {
        set(values: unknown) {
          if (table === actionMutationDetails) {
            updatedMutationDetails.push(values)
          }
          return {
            where() {
              return Promise.resolve([])
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, entries, insertedMutationDetails, updatedMutationDetails }
}

function makeGetApprovalDb(input: {
  approval?: ActionApproval
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
  payloads?: ActionLedgerPayload[]
  relayOutbox?: ActionLedgerRelayOutbox[]
}) {
  const calls: string[] = []
  const selectRows = [
    input.approval ? [input.approval] : [],
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
    input.payloads ?? [],
    input.relayOutbox ?? [],
  ]
  const callLabels = [
    "action_approvals",
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
    "action_ledger_payloads",
    "action_ledger_outbox",
  ]
  let selectIndex = 0

  const db = {
    select() {
      const index = selectIndex
      selectIndex += 1
      return {
        from() {
          return {
            where() {
              if (index >= 4) {
                calls.push(callLabels[index] ?? `select_${index}`)
                return Promise.resolve(selectRows[index] ?? [])
              }

              return {
                limit() {
                  calls.push(callLabels[index] ?? `select_${index}`)
                  return Promise.resolve(selectRows[index] ?? [])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeValidateApprovedActionDb(input: {
  approval?: ActionApproval
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
  payloads?: ActionLedgerPayload[]
  relayOutbox?: ActionLedgerRelayOutbox[]
  existingExecutions?: ActionLedgerEntry[]
}) {
  const calls: string[] = []
  const selectRows = [
    input.approval ? [input.approval] : [],
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
    input.payloads ?? [],
    input.relayOutbox ?? [],
  ]
  const callLabels = [
    "action_approvals",
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
    "action_ledger_payloads",
    "action_ledger_outbox",
  ]
  let selectIndex = 0

  const listQuery = {
    where() {
      return listQuery
    },
    orderBy() {
      return listQuery
    },
    limit() {
      calls.push("action_ledger_entries:list")
      return Promise.resolve(input.existingExecutions ?? [])
    },
  }

  const db = {
    select() {
      const index = selectIndex
      selectIndex += 1
      return {
        from() {
          if (index >= selectRows.length) {
            return {
              $dynamic() {
                return listQuery
              },
            }
          }

          return {
            where() {
              if (index >= 4) {
                calls.push(callLabels[index] ?? `select_${index}`)
                return Promise.resolve(selectRows[index] ?? [])
              }

              return {
                limit() {
                  calls.push(callLabels[index] ?? `select_${index}`)
                  return Promise.resolve(selectRows[index] ?? [])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeGetDelegationDb(row: ActionDelegation | null) {
  const calls: string[] = []
  const db = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  calls.push("action_delegations")
                  return Promise.resolve(row ? [row] : [])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeListDb(rows: ActionLedgerEntry[]) {
  const calls: Array<{ phase: string; argCount?: number; value?: number }> = []
  let limit = rows.length
  const query = {
    where() {
      calls.push({ phase: "where" })
      return query
    },
    orderBy(...args: unknown[]) {
      calls.push({ phase: "orderBy", argCount: args.length })
      return query
    },
    limit(value: number) {
      calls.push({ phase: "limit", value })
      limit = value
      return Promise.resolve(rows.slice(0, limit))
    },
  }

  const db = {
    select() {
      return {
        from() {
          return {
            $dynamic() {
              return query
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeRelayOutboxListDb(rows: ActionLedgerRelayOutbox[]) {
  const calls: Array<{ phase: string; argCount?: number; value?: number }> = []
  let limit = rows.length
  const query = {
    where() {
      calls.push({ phase: "where" })
      return query
    },
    orderBy(...args: unknown[]) {
      calls.push({ phase: "orderBy", argCount: args.length })
      return query
    },
    limit(value: number) {
      calls.push({ phase: "limit", value })
      limit = value
      return Promise.resolve(rows.slice(0, limit))
    },
  }

  const db = {
    select() {
      return {
        from() {
          return {
            $dynamic() {
              return query
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeApprovalListDb(rows: ActionApproval[]) {
  const calls: Array<{ phase: string; argCount?: number; value?: number }> = []
  let limit = rows.length
  const query = {
    where() {
      calls.push({ phase: "where" })
      return query
    },
    orderBy(...args: unknown[]) {
      calls.push({ phase: "orderBy", argCount: args.length })
      return query
    },
    limit(value: number) {
      calls.push({ phase: "limit", value })
      limit = value
      return Promise.resolve(rows.slice(0, limit))
    },
  }

  const db = {
    select() {
      return {
        from() {
          return {
            $dynamic() {
              return query
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeDelegationListDb(rows: ActionDelegation[]) {
  const calls: Array<{ phase: string; argCount?: number; value?: number }> = []
  let limit = rows.length
  const query = {
    where() {
      calls.push({ phase: "where" })
      return query
    },
    orderBy(...args: unknown[]) {
      calls.push({ phase: "orderBy", argCount: args.length })
      return query
    },
    limit(value: number) {
      calls.push({ phase: "limit", value })
      limit = value
      return Promise.resolve(rows.slice(0, limit))
    },
  }

  const db = {
    select() {
      return {
        from() {
          return {
            $dynamic() {
              return query
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeRelayOutboxSqlRow(row: ActionLedgerRelayOutbox) {
  return {
    id: row.id,
    action_id: row.actionId,
    organization_id: row.organizationId,
    relay_status: row.relayStatus,
    payload_ref: row.payloadRef,
    attempt_count: row.attemptCount,
    next_retry_at: row.nextRetryAt,
    last_error: row.lastError,
    created_at: row.createdAt,
    processed_at: row.processedAt,
  }
}

function makeRelayOutboxClaimDb(rows: ActionLedgerRelayOutbox[]) {
  const queries: unknown[] = []
  const db = {
    execute(query: unknown) {
      queries.push(query)
      return Promise.resolve({ rows: rows.map(makeRelayOutboxSqlRow) })
    },
  } as AnyDrizzleDb

  return { db, queries }
}

function makeRelayOutboxUpdateDb(row: ActionLedgerRelayOutbox | null) {
  const patches: unknown[] = []
  const db = {
    update() {
      return {
        set(values: unknown) {
          patches.push(values)
          return {
            where() {
              return {
                returning() {
                  return Promise.resolve(row ? [row] : [])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, patches }
}

function makeApprovalLifecycleDb(
  input: { entries?: ActionLedgerEntry[]; approvals?: ActionApproval[] } = {},
) {
  const entries = [...(input.entries ?? [])]
  const approvals = [...(input.approvals ?? [])]
  const insertedMutationDetails: unknown[] = []
  const insertedPayloads: unknown[] = []
  const insertedRelayOutbox: unknown[] = []
  const insertedSensitiveReadDetails: unknown[] = []
  const transactionCalls: string[] = []

  const db = {
    transaction<T>(callback: (tx: AnyDrizzleDb) => Promise<T>) {
      transactionCalls.push("transaction")
      return callback(db as AnyDrizzleDb)
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === actionApprovals) {
                    return Promise.resolve(approvals.slice(0, 1))
                  }
                  if (table === actionLedgerEntries) {
                    return Promise.resolve(entries.slice(0, 1))
                  }
                  return Promise.resolve([])
                },
              }
            },
          }
        },
      }
    },
    insert(table: unknown) {
      return {
        values(values: NewActionLedgerEntry | NewActionApproval | Record<string, unknown>[]) {
          if (Array.isArray(values)) {
            insertedPayloads.push(...values)
            return {}
          }

          if ("payloadKind" in values) {
            insertedPayloads.push(values)
            return {}
          }

          if ("relayStatus" in values) {
            insertedRelayOutbox.push(values)
            return {}
          }

          if ("reasonCode" in values && table !== actionApprovals) {
            insertedSensitiveReadDetails.push(values)
            return {}
          }

          if ("summary" in values || "reversalKind" in values) {
            insertedMutationDetails.push(values)
            return {}
          }

          return {
            returning() {
              if (table === actionApprovals) {
                const approvalValues = values as NewActionApproval
                const approval = makeApproval({
                  ...approvalValues,
                  id: approvalValues.id ?? `appr_${approvals.length + 1}`,
                  decidedAt: approvalValues.decidedAt ?? null,
                  decidedByPrincipalId: approvalValues.decidedByPrincipalId ?? null,
                  delegatedFromPrincipalId: approvalValues.delegatedFromPrincipalId ?? null,
                  assignedToPrincipalId: approvalValues.assignedToPrincipalId ?? null,
                  targetSnapshotRef: approvalValues.targetSnapshotRef ?? null,
                  reasonCode: approvalValues.reasonCode ?? null,
                  expiresAt: approvalValues.expiresAt ?? null,
                  createdAt: approvalValues.createdAt ?? baseDate,
                })
                approvals.push(approval)
                return Promise.resolve([approval])
              }

              const entryValues = values as NewActionLedgerEntry
              const entry = makeEntry({
                ...entryValues,
                id: `alge_${entries.length + 1}`,
                occurredAt: entryValues.occurredAt ?? baseDate,
                createdAt: entryValues.createdAt ?? baseDate,
                actorType: entryValues.actorType ?? null,
                principalSubtype: entryValues.principalSubtype ?? null,
                sessionId: entryValues.sessionId ?? null,
                apiTokenId: entryValues.apiTokenId ?? null,
                delegatedByPrincipalType: entryValues.delegatedByPrincipalType ?? null,
                delegatedByPrincipalId: entryValues.delegatedByPrincipalId ?? null,
                delegationId: entryValues.delegationId ?? null,
                callerType: entryValues.callerType ?? null,
                organizationId: entryValues.organizationId ?? null,
                routeOrToolName: entryValues.routeOrToolName ?? null,
                workflowRunId: entryValues.workflowRunId ?? null,
                workflowStepId: entryValues.workflowStepId ?? null,
                correlationId: entryValues.correlationId ?? null,
                causationActionId: entryValues.causationActionId ?? null,
                idempotencyScope: entryValues.idempotencyScope ?? null,
                idempotencyKey: entryValues.idempotencyKey ?? null,
                idempotencyFingerprint: entryValues.idempotencyFingerprint ?? null,
                capabilityId: entryValues.capabilityId ?? null,
                capabilityVersion: entryValues.capabilityVersion ?? null,
                authorizationSource: entryValues.authorizationSource ?? null,
                approvalId: entryValues.approvalId ?? null,
                amendsActionId: entryValues.amendsActionId ?? null,
              })
              entries.push(entry)
              return Promise.resolve([entry])
            },
          }
        },
      }
    },
    update(table: unknown) {
      return {
        set(values: Partial<ActionApproval>) {
          return {
            where() {
              return {
                returning() {
                  if (table !== actionApprovals) return Promise.resolve([])
                  const approval = approvals.find((row) => row.status === "pending")
                  if (!approval) return Promise.resolve([])
                  Object.assign(approval, values)
                  return Promise.resolve([approval])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return {
    db,
    entries,
    approvals,
    insertedMutationDetails,
    insertedPayloads,
    insertedRelayOutbox,
    insertedSensitiveReadDetails,
    transactionCalls,
  }
}

function makeAppendDb() {
  const entries: ActionLedgerEntry[] = []
  const insertedMutationDetails: unknown[] = []
  const insertedPayloads: unknown[] = []
  const insertedRelayOutbox: unknown[] = []
  const insertedSensitiveReadDetails: unknown[] = []
  const transactionCalls: string[] = []
  const db = {
    async transaction<T>(callback: (tx: AnyDrizzleDb) => Promise<T>) {
      transactionCalls.push("begin")
      try {
        const result = await callback(db as AnyDrizzleDb)
        transactionCalls.push("commit")
        return result
      } catch (error) {
        transactionCalls.push("rollback")
        throw error
      }
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(entries.slice(0, 1))
                },
              }
            },
          }
        },
      }
    },
    insert() {
      return {
        values(values: NewActionLedgerEntry | Record<string, unknown> | Record<string, unknown>[]) {
          if (Array.isArray(values)) {
            insertedPayloads.push(...values)
            return {}
          }

          if ("payloadKind" in values) {
            insertedPayloads.push(values)
            return {}
          }

          if ("relayStatus" in values) {
            insertedRelayOutbox.push(values)
            return {}
          }

          if ("reasonCode" in values || "disclosedFieldSet" in values) {
            insertedSensitiveReadDetails.push(values)
            return {}
          }

          if ("summary" in values || "reversalKind" in values) {
            insertedMutationDetails.push(values)
            return {}
          }

          return {
            returning() {
              const entryValues = values as NewActionLedgerEntry
              const entry = makeEntry({
                ...entryValues,
                id: `alge_${entries.length + 1}`,
                occurredAt: entryValues.occurredAt ?? baseDate,
                createdAt: entryValues.createdAt ?? baseDate,
                actorType: entryValues.actorType ?? null,
                principalSubtype: entryValues.principalSubtype ?? null,
                sessionId: entryValues.sessionId ?? null,
                apiTokenId: entryValues.apiTokenId ?? null,
                delegatedByPrincipalType: entryValues.delegatedByPrincipalType ?? null,
                delegatedByPrincipalId: entryValues.delegatedByPrincipalId ?? null,
                delegationId: entryValues.delegationId ?? null,
                callerType: entryValues.callerType ?? null,
                organizationId: entryValues.organizationId ?? null,
                routeOrToolName: entryValues.routeOrToolName ?? null,
                workflowRunId: entryValues.workflowRunId ?? null,
                workflowStepId: entryValues.workflowStepId ?? null,
                correlationId: entryValues.correlationId ?? null,
                causationActionId: entryValues.causationActionId ?? null,
                idempotencyScope: entryValues.idempotencyScope ?? null,
                idempotencyKey: entryValues.idempotencyKey ?? null,
                idempotencyFingerprint: entryValues.idempotencyFingerprint ?? null,
                capabilityId: entryValues.capabilityId ?? null,
                capabilityVersion: entryValues.capabilityVersion ?? null,
                authorizationSource: entryValues.authorizationSource ?? null,
                approvalId: entryValues.approvalId ?? null,
                amendsActionId: entryValues.amendsActionId ?? null,
              })
              entries.push(entry)
              return Promise.resolve([entry])
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return {
    db,
    entries,
    insertedMutationDetails,
    insertedPayloads,
    insertedRelayOutbox,
    insertedSensitiveReadDetails,
    transactionCalls,
  }
}
