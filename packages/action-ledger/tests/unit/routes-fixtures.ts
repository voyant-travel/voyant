import type { AnyDrizzleDb } from "@voyant-travel/db"
import { Hono } from "hono"

import { actionLedgerAdminRoutes } from "../../src/routes.js"
import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
} from "../../src/schema.js"

const baseDate = new Date("2026-05-15T10:00:00.000Z")

export function makeEntry(overrides: Partial<ActionLedgerEntry> = {}): ActionLedgerEntry {
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

export function makeMutationDetail(
  overrides: Partial<ActionMutationDetail> = {},
): ActionMutationDetail {
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

export function makeSensitiveReadDetail(
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

export function makePayload(overrides: Partial<ActionLedgerPayload> = {}): ActionLedgerPayload {
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

export function makeApproval(overrides: Partial<ActionApproval> = {}): ActionApproval {
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

export function makeDelegation(overrides: Partial<ActionDelegation> = {}): ActionDelegation {
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

export function makeApp(db: AnyDrizzleDb) {
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
