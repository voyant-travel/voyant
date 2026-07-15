import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, test } from "vitest"

import { __test__, actionLedgerService } from "../../src/service.js"
import { makeApproval, makeDelegation, makeEntry } from "./service-fixtures.js"
import { makeApprovalListDb, makeDelegationListDb, makeListDb } from "./service-list-fixtures.js"

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
