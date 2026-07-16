import type { AnyDrizzleDb } from "@voyant-travel/db"

import { buildIdempotencyFingerprint } from "./fingerprint.js"
import { actionLedgerService } from "./service.js"

export interface RunActionLedgerCanaryInput {
  organizationId?: string | null
  principalId?: string | null
  idempotencyKey?: string | null
  now?: Date
}

export interface RunActionLedgerCanaryResult {
  ok: boolean
  actionId: string
  replayed: boolean
  observedWrite: boolean
}

export async function runActionLedgerCanary(
  db: AnyDrizzleDb,
  input: RunActionLedgerCanaryInput = {},
): Promise<RunActionLedgerCanaryResult> {
  const now = input.now ?? new Date()
  const idempotencyKey = input.idempotencyKey ?? `action-ledger-canary:${now.toISOString()}`
  // Keep the pre-removal fingerprint input stable so persisted canary keys replay
  // across upgrades even though the relay outbox no longer consumes this reference.
  const legacyPayloadRef = `action-ledger-canary:${idempotencyKey}`
  const idempotencyFingerprint = await buildIdempotencyFingerprint({
    actionName: "action_ledger.canary.write",
    actionVersion: "v1",
    targetType: "action_ledger_canary",
    targetId: idempotencyKey,
    commandInput: { payloadRef: legacyPayloadRef },
  })

  const appendResult = await actionLedgerService.appendEntry(db, {
    occurredAt: now,
    actionName: "action_ledger.canary.write",
    actionVersion: "v1",
    actionKind: "execute",
    status: "succeeded",
    evaluatedRisk: "low",
    actorType: "system",
    principalType: "system",
    principalId: input.principalId ?? "action-ledger-canary",
    principalSubtype: null,
    sessionId: null,
    apiTokenId: null,
    internalRequest: true,
    delegatedByPrincipalType: null,
    delegatedByPrincipalId: null,
    delegationId: null,
    callerType: "system",
    organizationId: input.organizationId ?? null,
    routeOrToolName: "action-ledger.canary",
    workflowRunId: null,
    workflowStepId: null,
    correlationId: null,
    causationActionId: null,
    idempotencyScope: "action-ledger-canary",
    idempotencyKey,
    idempotencyFingerprint,
    targetType: "action_ledger_canary",
    targetId: idempotencyKey,
    capabilityId: "action-ledger.canary",
    capabilityVersion: "v1",
    authorizationSource: "action-ledger.canary",
    approvalId: null,
    amendsActionId: null,
    mutationDetail: {
      summary: "Synthetic action ledger canary write",
      reversalKind: "none",
    },
  })

  const entries = await actionLedgerService.listEntries(db, {
    targetType: "action_ledger_canary",
    targetId: idempotencyKey,
    actionName: "action_ledger.canary.write",
    limit: 1,
  })

  const observedWrite = entries.entries.some((entry) => entry.id === appendResult.entry.id)
  return {
    ok: observedWrite,
    actionId: appendResult.entry.id,
    replayed: appendResult.replayed,
    observedWrite,
  }
}
