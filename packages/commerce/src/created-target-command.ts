import {
  type ActionLedgerRequestContextValues,
  buildCreatedTargetIdempotencyScope,
  type ExecuteCreatedTargetCommandHandlers,
  type ExecuteCreatedTargetCommandInput,
  type ExecuteCreatedTargetCommandResult,
  executeCreatedTargetCommand,
  mapActionLedgerRequestContext,
} from "@voyant-travel/action-ledger"
import { ToolError, type ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  buildCommerceCreatedTargetFingerprint,
  type COMMERCE_CREATED_TARGET_POLICIES,
} from "./created-target-policy.js"

type CommerceCreatedTargetPolicy =
  (typeof COMMERCE_CREATED_TARGET_POLICIES)[keyof typeof COMMERCE_CREATED_TARGET_POLICIES]

type CommerceCreatedCommandExecutor = (
  db: PostgresJsDatabase,
  input: ExecuteCreatedTargetCommandInput & { resultReferenceType: string },
  handlers: ExecuteCreatedTargetCommandHandlers<{ id: string }, string>,
) => Promise<ExecuteCreatedTargetCommandResult<{ id: string }, string>>

export async function executeCommerceCreate(
  db: PostgresJsDatabase,
  context: ActionLedgerRequestContextValues,
  policy: CommerceCreatedTargetPolicy,
  legacyIdempotencyKey: string | undefined,
  commandInput: unknown,
  admitted: ToolHandlerActionPolicyContext,
  create: (tx: PostgresJsDatabase) => Promise<{ id: string }>,
  executor: CommerceCreatedCommandExecutor = executeCreatedTargetCommand,
) {
  const principal = mapActionLedgerRequestContext(context)
  if (principal.principalId === "unknown_request") {
    throw new TypeError("Commerce created-target commands require a concrete principal")
  }
  const idempotencyKey = admittedCreatedCommandIdempotencyKey(admitted, legacyIdempotencyKey)
  const selectedActionName = admitted.actionPolicy.capabilityId
  const selectedActionVersion = admitted.actionPolicy.version
  const fingerprint = await buildCommerceCreatedTargetFingerprint(
    {
      ...policy,
      actionName: selectedActionName,
      actionVersion: selectedActionVersion,
      capabilityId: selectedActionName,
      capabilityVersion: selectedActionVersion,
    } as CommerceCreatedTargetPolicy,
    idempotencyKey,
    commandInput,
  )
  const scope = await buildCreatedTargetIdempotencyScope({
    actionName: selectedActionName,
    actionVersion: selectedActionVersion,
    principalType: principal.principalType,
    principalId: principal.principalId,
    organizationId: principal.organizationId,
  })
  return executor(
    db,
    {
      context,
      actionName: selectedActionName,
      actionVersion: selectedActionVersion,
      actionKind: "create",
      evaluatedRisk: policy.evaluatedRisk,
      commandTarget: { type: policy.commandTargetType, id: idempotencyKey },
      canonicalTargetType: policy.canonicalTargetType,
      resultReferenceType: policy.resultReferenceType,
      capabilityId: selectedActionName,
      capabilityVersion: selectedActionVersion,
      approvalPolicy: policy.approvalPolicy,
      approvalReasonCode: policy.approvalReasonCode,
      commandInput,
      routeOrToolName: admitted.capabilityId,
      authorizationSource: "selected_graph_mcp_handler",
      idempotency: { scope, key: idempotencyKey, fingerprint },
    },
    {
      async create(tx) {
        const value = await create(tx as PostgresJsDatabase)
        return { value, targetId: value.id }
      },
      async replay(_tx, result) {
        return { id: result.reference.id }
      },
    },
  )
}

function admittedCreatedCommandIdempotencyKey(
  admitted: ToolHandlerActionPolicyContext,
  legacyIdempotencyKey: string | undefined,
): string {
  const idempotencyKey = admitted.invocation.idempotencyKey?.trim()
  if (!idempotencyKey) {
    throw new ToolError(
      "Created-target command idempotency must come from the admitted Tool invocation.",
      "ACTION_POLICY_REQUIRED",
      { capabilityId: admitted.capabilityId },
    )
  }
  if (legacyIdempotencyKey !== undefined && legacyIdempotencyKey !== idempotencyKey) {
    throw new ToolError(
      "The legacy top-level idempotency key does not match the admitted Tool invocation.",
      "INVALID_INPUT",
      { capabilityId: admitted.capabilityId },
    )
  }
  return idempotencyKey
}
