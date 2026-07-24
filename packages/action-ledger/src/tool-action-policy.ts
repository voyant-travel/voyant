import type { VoyantGraphActionDeclaration } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  type ToolActionPolicyExecutionInput,
  type ToolActionPolicyGate,
  ToolError,
} from "@voyant-travel/tools"

import {
  buildActionApprovalCommandFingerprint,
  buildIdempotencyFingerprint,
} from "./fingerprint.js"
import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
  appendActionLedgerSensitiveRead,
  mapActionLedgerRequestContext,
} from "./request-context.js"
import type { ActionLedgerEntry } from "./schema.js"
import { actionLedgerService } from "./service.js"

export interface CreateToolActionPolicyGateInput {
  db: AnyDrizzleDb
  selectedActions: readonly VoyantGraphActionDeclaration[]
  requestContext: ActionLedgerRequestContextValues
}

/**
 * Gate generic Tool execution with the selected graph action and the existing
 * action-ledger approval/idempotency model. The requested preflight is written
 * before domain dispatch so a missing ledger can never degrade to an unlogged
 * mutation; success/failure is then appended with the same exact fingerprint.
 */
export function createToolActionPolicyGate(
  input: CreateToolActionPolicyGateInput,
): ToolActionPolicyGate {
  return {
    async execute<T>(execution: ToolActionPolicyExecutionInput, dispatch: () => Promise<T>) {
      const selected = resolveSelectedAction(input.selectedActions, execution)
      assertConfirmation(execution)
      assertActorAllowed(selected, input.requestContext.actor)

      if (selected.approval === "conditional") {
        throw new ToolError(
          "Conditional graph approval requires a package-owned evaluator; generic dispatch fails closed.",
          "APPROVAL_REQUIRED",
          { actionId: selected.id },
        )
      }
      if (selected.kind !== "execute" && selected.approval === "required") {
        throw new ToolError(
          "Approval-required graph actions must use an executable domain command; refusing read dispatch.",
          "APPROVAL_REQUIRED",
          { actionId: selected.id, kind: selected.kind },
        )
      }
      if (selected.targetLifecycle === "created") {
        throw new ToolError(
          "Created-target actions require a handler-owned durable command claim; generic dispatch fails closed.",
          "ACTION_POLICY_REQUIRED",
          { actionId: selected.id, durability: selected.createdTarget?.durability ?? null },
        )
      }

      if (selected.ledger === "optional" && selected.approval !== "required") {
        return dispatch()
      }

      const targetId = requiredInvocationString(execution, "targetId")
      const principal = concretePrincipal(input.requestContext)

      if (selected.kind !== "execute") {
        await appendActionLedgerSensitiveRead(input.db, {
          context: input.requestContext,
          actionName: selected.capabilityId ?? selected.id,
          actionVersion: selected.version,
          evaluatedRisk: selected.risk,
          targetType: selected.targetType,
          targetId,
          routeOrToolName: execution.capabilityId,
          capabilityId: selected.capabilityId ?? selected.id,
          capabilityVersion: selected.version,
          authorizationSource: "selected_graph_mcp_gate",
          reasonCode: execution.invocation.reasonCode ?? "mcp_action_policy_preflight",
          decisionPolicy: selected.policy ?? selected.id,
        })
        return dispatch()
      }

      const idempotencyKey = requiredInvocationString(execution, "idempotencyKey")
      const fingerprint = await commandFingerprint(selected, execution, targetId)
      const approved =
        selected.approval === "required"
          ? await validateApproval({
              db: input.db,
              selected,
              execution,
              targetId,
              idempotencyKey,
              fingerprint,
              principal,
            })
          : null

      const actionName = selected.capabilityId ?? selected.id
      const preflight = await appendActionLedgerMutation(input.db, {
        context: input.requestContext,
        actionName,
        actionVersion: selected.version,
        actionKind: "execute",
        status: "requested",
        evaluatedRisk: selected.risk,
        targetType: selected.targetType,
        targetId,
        routeOrToolName: execution.capabilityId,
        capabilityId: actionName,
        capabilityVersion: selected.version,
        authorizationSource: "selected_graph_mcp_gate",
        causationActionId: approved?.requestedAction.id ?? null,
        approvalId: approved?.approval.id ?? null,
        idempotencyScope: approved
          ? `${approved.approval.id}:mcp-execution-preflight`
          : `${actionName}:${selected.version}:${targetId}:mcp-preflight`,
        idempotencyKey: approved?.approval.id ?? idempotencyKey,
        idempotencyFingerprint: fingerprint,
        mutationDetail: {
          summary: `MCP Tool ${execution.canonicalName} passed selected action policy`,
          reversalKind: "none",
        },
      })
      if (preflight.replayed) {
        throw new ToolError(
          "This exact Tool execution has already been claimed; refusing duplicate dispatch.",
          "AUTHORIZATION_DENIED",
          { actionId: preflight.entry.id, idempotencyKey },
        )
      }

      try {
        const result = await dispatch()
        await appendExecutionResult({
          db: input.db,
          context: input.requestContext,
          execution,
          selected,
          targetId,
          idempotencyKey,
          fingerprint,
          preflightActionId: preflight.entry.id,
          approved,
          status: "succeeded",
        })
        return result
      } catch (error) {
        await appendExecutionResult({
          db: input.db,
          context: input.requestContext,
          execution,
          selected,
          targetId,
          idempotencyKey,
          fingerprint,
          preflightActionId: preflight.entry.id,
          approved,
          status: "failed",
        })
        throw error
      }
    },
  }
}

function resolveSelectedAction(
  actions: readonly VoyantGraphActionDeclaration[],
  execution: ToolActionPolicyExecutionInput,
): VoyantGraphActionDeclaration {
  const selected = actions.find(
    (action) =>
      action.id === execution.actionPolicy.id &&
      action.version === execution.actionPolicy.version &&
      action.from?.tools?.includes(execution.capabilityId),
  )
  if (
    !selected ||
    (selected.capabilityId ?? selected.id) !== execution.actionPolicy.capabilityId ||
    selected.kind !== execution.actionPolicy.kind ||
    selected.targetType !== execution.actionPolicy.targetType ||
    selected.risk !== execution.actionPolicy.risk ||
    selected.ledger !== execution.actionPolicy.ledger ||
    (selected.approval ?? "never") !== execution.actionPolicy.approval ||
    (selected.targetLifecycle ?? "existing") !==
      (execution.actionPolicy.targetLifecycle ?? "existing") ||
    selected.createdTarget?.commandTargetType !==
      execution.actionPolicy.createdTarget?.commandTargetType ||
    selected.createdTarget?.resultReferenceType !==
      execution.actionPolicy.createdTarget?.resultReferenceType ||
    selected.createdTarget?.durability !== execution.actionPolicy.createdTarget?.durability
  ) {
    throw new ToolError(
      "The Tool action policy does not resolve exactly to the selected deployment graph.",
      "ACTION_POLICY_REQUIRED",
      { capabilityId: execution.capabilityId, actionId: execution.actionPolicy.id },
    )
  }
  return selected
}

function assertConfirmation(execution: ToolActionPolicyExecutionInput): void {
  if (
    execution.actionPolicy.invocation.requiredFields.includes("confirmed") &&
    execution.invocation.confirmed !== true
  ) {
    throw new ToolError(
      "This Tool requires explicit confirmation before dispatch.",
      "CONFIRMATION_REQUIRED",
      { capabilityId: execution.capabilityId },
    )
  }
}

function assertActorAllowed(
  selected: VoyantGraphActionDeclaration,
  actor: string | null | undefined,
): void {
  if (
    selected.allowedActorTypes?.length &&
    (!actor || !selected.allowedActorTypes.includes(actor))
  ) {
    throw new ToolError(
      "The authenticated actor is not allowed by the selected graph action.",
      "AUTHORIZATION_DENIED",
      { actionId: selected.id, actor: actor ?? null },
    )
  }
}

function requiredInvocationString(
  execution: ToolActionPolicyExecutionInput,
  field: "targetId" | "idempotencyKey" | "approvalId" | "idempotencyFingerprint",
): string {
  const value = execution.invocation[field]
  if (!value?.trim()) {
    throw new ToolError(
      `Tool action invocation metadata requires ${field}.`,
      field === "approvalId" ? "APPROVAL_REQUIRED" : "ACTION_POLICY_REQUIRED",
      { capabilityId: execution.capabilityId, field },
    )
  }
  return value
}

function concretePrincipal(context: ActionLedgerRequestContextValues) {
  const principal = mapActionLedgerRequestContext(context)
  if (principal.principalId === "unknown_request") {
    throw new ToolError(
      "A concrete authenticated principal is required for audited Tool dispatch.",
      "AUTHORIZATION_DENIED",
    )
  }
  return principal
}

async function commandFingerprint(
  selected: VoyantGraphActionDeclaration,
  execution: ToolActionPolicyExecutionInput,
  targetId: string,
): Promise<string> {
  const actionName = selected.capabilityId ?? selected.id
  if (selected.approval === "required") {
    return buildActionApprovalCommandFingerprint({
      actionName,
      actionVersion: selected.version,
      targetType: selected.targetType,
      targetId,
      commandInput: execution.commandInput,
      approvalPolicy: "required",
      capabilityId: actionName,
      capabilityVersion: selected.version,
      evaluatedRisk: selected.risk,
      reasonCode: execution.invocation.reasonCode ?? null,
    })
  }
  return buildIdempotencyFingerprint({
    actionName,
    actionVersion: selected.version,
    targetType: selected.targetType,
    targetId,
    commandInput: execution.commandInput,
    policyInputs: {
      capabilityId: execution.capabilityId,
      capabilityVersion: execution.capabilityVersion,
      risk: selected.risk,
      ledger: selected.ledger,
    },
  })
}

async function validateApproval(input: {
  db: AnyDrizzleDb
  selected: VoyantGraphActionDeclaration
  execution: ToolActionPolicyExecutionInput
  targetId: string
  idempotencyKey: string
  fingerprint: string
  principal: ReturnType<typeof mapActionLedgerRequestContext>
}) {
  const approvalId = requiredInvocationString(input.execution, "approvalId")
  const suppliedFingerprint = requiredInvocationString(input.execution, "idempotencyFingerprint")
  if (suppliedFingerprint !== input.fingerprint) {
    throw new ToolError(
      "The supplied idempotency fingerprint does not match this exact Tool command.",
      "AUTHORIZATION_DENIED",
      { approvalId, reason: "fingerprint_mismatch" },
    )
  }
  const actionName = input.selected.capabilityId ?? input.selected.id
  const validation = await actionLedgerService.validateApprovedAction(input.db, {
    approvalId,
    actionName,
    actionVersion: input.selected.version,
    requestedActionKind: "execute",
    requestedActionStatus: "awaiting_approval",
    targetType: input.selected.targetType,
    targetId: input.targetId,
    routeOrToolName: input.execution.capabilityId,
    principalType: input.principal.principalType,
    principalId: input.principal.principalId,
    idempotencyFingerprint: input.fingerprint,
    executionActionKind: "execute",
    executionStatus: "succeeded",
  })
  if (!validation.ok) {
    throw new ToolError(
      "The approval does not authorize this exact Tool command.",
      "AUTHORIZATION_DENIED",
      { approvalId, reason: validation.reason },
    )
  }
  if (validation.requestedAction.idempotencyKey !== input.idempotencyKey) {
    throw new ToolError(
      "The execution idempotency key does not match the approved request.",
      "AUTHORIZATION_DENIED",
      { approvalId, reason: "idempotency_key_mismatch" },
    )
  }
  return validation
}

async function appendExecutionResult(input: {
  db: AnyDrizzleDb
  context: ActionLedgerRequestContextValues
  execution: ToolActionPolicyExecutionInput
  selected: VoyantGraphActionDeclaration
  targetId: string
  idempotencyKey: string
  fingerprint: string
  preflightActionId: string
  approved: Awaited<ReturnType<typeof validateApproval>> | null
  status: Extract<ActionLedgerEntry["status"], "succeeded" | "failed">
}): Promise<void> {
  const actionName = input.selected.capabilityId ?? input.selected.id
  await appendActionLedgerMutation(input.db, {
    context: input.context,
    actionName,
    actionVersion: input.selected.version,
    actionKind: "execute",
    status: input.status,
    evaluatedRisk: input.selected.risk,
    targetType: input.selected.targetType,
    targetId: input.targetId,
    routeOrToolName: input.execution.capabilityId,
    capabilityId: actionName,
    capabilityVersion: input.selected.version,
    authorizationSource: "selected_graph_mcp_gate",
    causationActionId: input.approved?.requestedAction.id ?? input.preflightActionId,
    approvalId: input.approved?.approval.id ?? null,
    idempotencyScope: input.approved
      ? `${input.approved.approval.id}:execution`
      : `${actionName}:${input.selected.version}:${input.targetId}:mcp-result`,
    idempotencyKey: input.approved?.approval.id ?? input.idempotencyKey,
    idempotencyFingerprint: input.fingerprint,
    mutationDetail: {
      summary: `MCP Tool ${input.execution.canonicalName} ${input.status}`,
      reversalKind: input.selected.reversible ? "domain_command" : "none",
    },
  })
}
