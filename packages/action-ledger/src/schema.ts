import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const actionLedgerActionKindEnum = pgEnum("action_ledger_action_kind", [
  "read",
  "create",
  "update",
  "delete",
  "execute",
  "approve",
  "reject",
  "reverse",
  "compensate",
  "duplicate",
])

export const actionLedgerStatusEnum = pgEnum("action_ledger_status", [
  "requested",
  "awaiting_approval",
  "approved",
  "denied",
  "succeeded",
  "failed",
  "reversed",
  "compensated",
  "expired",
  "cancelled",
  "superseded",
])

export const actionLedgerRiskEnum = pgEnum("action_ledger_risk", [
  "low",
  "medium",
  "high",
  "critical",
])

export const actionLedgerPrincipalTypeEnum = pgEnum("action_ledger_principal_type", [
  "user",
  "api_key",
  "agent",
  "workflow",
  "system",
])

export const actionLedgerRedactionStatusEnum = pgEnum("action_ledger_redaction_status", [
  "none",
  "redacted",
  "tombstoned",
  "crypto_shredded",
])

export const actionLedgerApprovalStatusEnum = pgEnum("action_ledger_approval_status", [
  "pending",
  "approved",
  "denied",
  "expired",
  "cancelled",
  "superseded",
])

export const actionLedgerReversalKindEnum = pgEnum("action_ledger_reversal_kind", [
  "none",
  "revert",
  "compensate",
  "domain_command",
])

export const actionLedgerReversalStateEnum = pgEnum("action_ledger_reversal_state", [
  "not_reversible",
  "available",
  "requested",
  "running",
  "completed",
  "failed",
  "expired",
])

export const actionLedgerReversalOutcomeEnum = pgEnum("action_ledger_reversal_outcome", [
  "full",
  "partial",
  "failed",
])

export const actionLedgerEntries = pgTable(
  "action_ledger_entries",
  {
    id: typeId("action_ledger_entries"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actionName: text("action_name").notNull(),
    actionVersion: text("action_version").notNull(),
    actionKind: actionLedgerActionKindEnum("action_kind").notNull(),
    status: actionLedgerStatusEnum("status").notNull(),
    evaluatedRisk: actionLedgerRiskEnum("evaluated_risk").notNull(),
    actorType: text("actor_type"),
    principalType: actionLedgerPrincipalTypeEnum("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    principalSubtype: text("principal_subtype"),
    sessionId: text("session_id"),
    apiTokenId: text("api_token_id"),
    internalRequest: boolean("internal_request").notNull().default(false),
    delegatedByPrincipalType: actionLedgerPrincipalTypeEnum("delegated_by_principal_type"),
    delegatedByPrincipalId: text("delegated_by_principal_id"),
    delegationId: text("delegation_id"),
    callerType: text("caller_type"),
    organizationId: text("organization_id"),
    routeOrToolName: text("route_or_tool_name"),
    workflowRunId: text("workflow_run_id"),
    workflowStepId: text("workflow_step_id"),
    correlationId: text("correlation_id"),
    causationActionId: text("causation_action_id"),
    idempotencyScope: text("idempotency_scope"),
    idempotencyKey: text("idempotency_key"),
    idempotencyFingerprint: text("idempotency_fingerprint"),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    capabilityId: text("capability_id"),
    capabilityVersion: text("capability_version"),
    authorizationSource: text("authorization_source"),
    approvalId: text("approval_id"),
    amendsActionId: text("amends_action_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_action_ledger_entries_principal").on(
      table.principalType,
      table.principalId,
      table.occurredAt,
    ),
    index("idx_action_ledger_entries_api_token").on(table.apiTokenId, table.occurredAt),
    index("idx_action_ledger_entries_session").on(table.sessionId, table.occurredAt),
    index("idx_action_ledger_entries_target").on(
      table.targetType,
      table.targetId,
      table.occurredAt,
    ),
    index("idx_action_ledger_entries_workflow").on(
      table.workflowRunId,
      table.workflowStepId,
      table.occurredAt,
    ),
    index("idx_action_ledger_entries_correlation").on(table.correlationId, table.occurredAt),
    index("idx_action_ledger_entries_causation").on(table.causationActionId),
    index("idx_action_ledger_entries_control_state").on(
      table.evaluatedRisk,
      table.status,
      table.occurredAt,
    ),
    index("idx_action_ledger_entries_capability").on(
      table.capabilityId,
      table.capabilityVersion,
      table.occurredAt,
    ),
    uniqueIndex("idx_action_ledger_entries_idempotency")
      .on(
        table.idempotencyScope,
        table.actionName,
        table.targetType,
        table.targetId,
        table.idempotencyKey,
      )
      .where(sql`
        ${table.idempotencyKey} IS NOT NULL
      `),
  ],
)

export const actionDelegations = pgTable(
  "action_delegations",
  {
    id: typeId("action_delegations"),
    rootPrincipalType: actionLedgerPrincipalTypeEnum("root_principal_type").notNull(),
    rootPrincipalId: text("root_principal_id").notNull(),
    parentPrincipalType: actionLedgerPrincipalTypeEnum("parent_principal_type").notNull(),
    parentPrincipalId: text("parent_principal_id").notNull(),
    childPrincipalType: actionLedgerPrincipalTypeEnum("child_principal_type").notNull(),
    childPrincipalId: text("child_principal_id").notNull(),
    grantSource: text("grant_source").notNull(),
    capabilityScopeRef: text("capability_scope_ref"),
    budgetScopeRef: text("budget_scope_ref"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_action_delegations_root").on(table.rootPrincipalType, table.rootPrincipalId),
    index("idx_action_delegations_child").on(table.childPrincipalType, table.childPrincipalId),
    index("idx_action_delegations_parent").on(table.parentPrincipalType, table.parentPrincipalId),
  ],
)

export const actionMutationDetails = pgTable(
  "action_mutation_details",
  {
    actionId: text("action_id")
      .primaryKey()
      .references(() => actionLedgerEntries.id, { onDelete: "cascade" }),
    commandInputRef: text("command_input_ref"),
    commandResultRef: text("command_result_ref"),
    summary: text("summary"),
    reversalKind: actionLedgerReversalKindEnum("reversal_kind").notNull().default("none"),
    reversalCommandId: text("reversal_command_id"),
    reversalCommandVersion: text("reversal_command_version"),
    reversalArgsRef: text("reversal_args_ref"),
    reversalStateProjection: actionLedgerReversalStateEnum("reversal_state_projection"),
    reversalOutcomeProjection: actionLedgerReversalOutcomeEnum("reversal_outcome_projection"),
    reversesActionId: text("reverses_action_id"),
    reversedByActionIdProjection: text("reversed_by_action_id_projection"),
  },
  (table) => [
    index("idx_action_mutation_details_reverses").on(table.reversesActionId),
    index("idx_action_mutation_details_reversal_state").on(table.reversalStateProjection),
  ],
)

export const actionSensitiveReadDetails = pgTable("action_sensitive_read_details", {
  actionId: text("action_id")
    .primaryKey()
    .references(() => actionLedgerEntries.id, { onDelete: "cascade" }),
  reasonCode: text("reason_code"),
  disclosedFieldSet: jsonb("disclosed_field_set").$type<string[]>(),
  disclosureSummary: text("disclosure_summary"),
  decisionPolicy: text("decision_policy"),
})

export const actionApprovals = pgTable(
  "action_approvals",
  {
    id: typeId("action_approvals"),
    requestedActionId: text("requested_action_id")
      .notNull()
      .references(() => actionLedgerEntries.id, { onDelete: "cascade" }),
    status: actionLedgerApprovalStatusEnum("status").notNull().default("pending"),
    requestedByPrincipalId: text("requested_by_principal_id").notNull(),
    assignedToPrincipalId: text("assigned_to_principal_id"),
    decidedByPrincipalId: text("decided_by_principal_id"),
    delegatedFromPrincipalId: text("delegated_from_principal_id"),
    policyName: text("policy_name").notNull(),
    policyVersion: text("policy_version").notNull(),
    targetSnapshotRef: text("target_snapshot_ref"),
    riskSnapshot: actionLedgerRiskEnum("risk_snapshot").notNull(),
    reasonCode: text("reason_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_action_approvals_requested_action").on(table.requestedActionId),
    index("idx_action_approvals_status_expires").on(table.status, table.expiresAt),
    index("idx_action_approvals_assignee").on(table.assignedToPrincipalId, table.createdAt),
  ],
)

export const actionLedgerPayloads = pgTable(
  "action_ledger_payloads",
  {
    id: typeId("action_ledger_payloads"),
    actionId: text("action_id")
      .notNull()
      .references(() => actionLedgerEntries.id, { onDelete: "cascade" }),
    payloadKind: text("payload_kind").notNull(),
    schemaTag: text("schema_tag").notNull(),
    redactionStatus: actionLedgerRedactionStatusEnum("redaction_status").notNull().default("none"),
    retentionPolicy: text("retention_policy").notNull(),
    storageRef: text("storage_ref").notNull(),
    hash: text("hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_action_ledger_payloads_action").on(table.actionId),
    index("idx_action_ledger_payloads_expiry").on(table.expiresAt),
  ],
)

export type ActionLedgerEntry = typeof actionLedgerEntries.$inferSelect
export type NewActionLedgerEntry = typeof actionLedgerEntries.$inferInsert
export type ActionDelegation = typeof actionDelegations.$inferSelect
export type NewActionDelegation = typeof actionDelegations.$inferInsert
export type ActionMutationDetail = typeof actionMutationDetails.$inferSelect
export type NewActionMutationDetail = typeof actionMutationDetails.$inferInsert
export type ActionSensitiveReadDetail = typeof actionSensitiveReadDetails.$inferSelect
export type NewActionSensitiveReadDetail = typeof actionSensitiveReadDetails.$inferInsert
export type ActionApproval = typeof actionApprovals.$inferSelect
export type NewActionApproval = typeof actionApprovals.$inferInsert
export type ActionLedgerPayload = typeof actionLedgerPayloads.$inferSelect
export type NewActionLedgerPayload = typeof actionLedgerPayloads.$inferInsert
