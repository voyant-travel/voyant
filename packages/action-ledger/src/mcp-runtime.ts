import type { VoyantGraphActionDeclaration } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  defineToolContextContribution,
  requireService,
  TOOL_GRAPH_ACTIONS_RESOURCE,
  ToolError,
} from "@voyant-travel/tools"
import type { Context } from "hono"

import { buildActionApprovalCommandFingerprint } from "./fingerprint.js"
import {
  type ActionLedgerRequestContextValues,
  decideActionLedgerApproval,
  mapActionLedgerRequestContext,
  requestActionLedgerApproval,
} from "./request-context.js"
import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
} from "./schema.js"
import { actionLedgerService } from "./service.js"
import { createToolActionPolicyGate } from "./tool-action-policy.js"
import type {
  ActionApprovalDetailDto,
  ActionApprovalDto,
  ActionDelegationDto,
  ActionLedgerEntryDetailDto,
  ActionLedgerEntryDto,
  ActionLedgerToolServices,
  ListActionLedgerEntriesToolInput,
  RequestActionApprovalToolInput,
} from "./tools.js"

export * from "./tools.js"

type SelectedAction = VoyantGraphActionDeclaration
type ActionLedgerMcpContext = Context<{
  Bindings: Record<string, unknown>
  Variables: {
    db?: AnyDrizzleDb
    actor?: string
    userId?: string
    agentId?: string
    workflowPrincipalId?: string
    principalSubtype?: string
    sessionId?: string
    apiKeyId?: string
    callerType?: string
    organizationId?: string
    workflowRunId?: string
    workflowStepId?: string
    correlationId?: string
  }
}>

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["actionLedger", "toolActionPolicy"],
  async contribute({ request, context, resources }) {
    const c = request as ActionLedgerMcpContext
    const db = requireService((c.get("db") ?? context.db) as AnyDrizzleDb | undefined, "db")
    const selectedActions = resources[TOOL_GRAPH_ACTIONS_RESOURCE]
    if (!Array.isArray(selectedActions)) {
      throw new ToolError("Selected graph action policies are unavailable.", "MISSING_SERVICE", {
        resource: TOOL_GRAPH_ACTIONS_RESOURCE,
      })
    }

    return {
      actionLedger: createActionLedgerToolServices({
        db,
        selectedActions: selectedActions as SelectedAction[],
        requestContext: actionLedgerRequestContext(c),
      }),
      toolActionPolicy: createToolActionPolicyGate({
        db,
        selectedActions: selectedActions as SelectedAction[],
        requestContext: actionLedgerRequestContext(c),
      }),
    }
  },
})

export function createActionLedgerToolServices(input: {
  db: AnyDrizzleDb
  selectedActions: readonly SelectedAction[]
  requestContext: ActionLedgerRequestContextValues
}): ActionLedgerToolServices {
  return {
    async listEntries(query: ListActionLedgerEntriesToolInput) {
      const result = await actionLedgerService.listEntries(input.db, query)
      return {
        data: result.entries.map(entryDto),
        nextCursor: result.nextCursor,
      }
    },
    async getEntry(id) {
      const result = await actionLedgerService.getEntry(input.db, id)
      return result ? entryDetailDto(result) : null
    },
    async getTargetTimeline(query) {
      const result = await actionLedgerService.listEntries(input.db, {
        targetType: query.targetType,
        targetId: query.targetId,
        cursor: query.cursor,
        sortDir: "desc",
        limit: query.limit ?? 50,
      })
      const details = await Promise.all(
        result.entries.map((entry) => actionLedgerService.getEntry(input.db, entry.id)),
      )
      const summaries = new Map(
        details.map(
          (detail) => [detail?.entry.id, detail?.mutationDetail?.summary ?? null] as const,
        ),
      )
      return {
        data: result.entries.map((entry) => ({
          ...entryDto(entry),
          mutationSummary: summaries.get(entry.id) ?? null,
        })),
        nextCursor: result.nextCursor,
      }
    },
    async listApprovals(query) {
      const result = await actionLedgerService.listApprovals(input.db, query)
      return { data: result.approvals.map(approvalDto), nextCursor: result.nextCursor }
    },
    async getApproval(id) {
      const result = await actionLedgerService.getApproval(input.db, id)
      return result ? approvalDetailDto(result) : null
    },
    async listDelegations(query) {
      const result = await actionLedgerService.listDelegations(input.db, query)
      return { data: result.delegations.map(delegationDto), nextCursor: result.nextCursor }
    },
    async getDelegation(id) {
      const result = await actionLedgerService.getDelegation(input.db, id)
      return result ? delegationDto(result.delegation) : null
    },
    async requestApproval(request: RequestActionApprovalToolInput) {
      const currentPrincipal = writePrincipal(input.requestContext)
      const selected = selectedApprovalRequestAction(input.selectedActions, request)
      const capabilityId = selected.capabilityId ?? selected.id
      const reasonCode = request.reasonCode ?? null
      const idempotencyFingerprint = await buildActionApprovalCommandFingerprint({
        actionName: capabilityId,
        actionVersion: selected.version,
        targetType: selected.targetType,
        targetId: request.targetId,
        commandInput: request.commandInput ?? null,
        approvalPolicy: "required",
        capabilityId,
        capabilityVersion: selected.version,
        evaluatedRisk: selected.risk,
        reasonCode,
      })
      const result = await requestActionLedgerApproval(input.db, {
        context: input.requestContext,
        actionName: capabilityId,
        actionVersion: selected.version,
        actionKind: "execute",
        evaluatedRisk: selected.risk,
        targetType: selected.targetType,
        targetId: request.targetId,
        routeOrToolName: selected.from?.tools?.[0] ?? null,
        capabilityId,
        capabilityVersion: selected.version,
        authorizationSource: "selected_graph",
        idempotencyScope: `${capabilityId}:${selected.version}:approval`,
        idempotencyKey: request.idempotencyKey,
        idempotencyFingerprint,
        approval: {
          requestedByPrincipalId: currentPrincipal,
          assignedToPrincipalId: request.assignedToPrincipalId ?? null,
          policyName: selected.policy ?? selected.id,
          policyVersion: selected.version,
          targetSnapshotRef: request.targetSnapshotRef ?? null,
          riskSnapshot: selected.risk,
          reasonCode,
          expiresAt: request.expiresAt ?? null,
        },
      })
      return {
        requestedAction: entryDto(result.requestedAction),
        approval: approvalDto(result.approval),
        replayed: result.replayed,
      }
    },
    async decideApproval({ approvalId, status }) {
      const currentPrincipal = writePrincipal(input.requestContext)
      const existing = await actionLedgerService.getApproval(input.db, approvalId)
      if (!existing) {
        throw new ToolError(`Action approval "${approvalId}" was not found.`, "NOT_FOUND", {
          approvalId,
        })
      }
      assertApprovalAuthority({
        approval: existing.approval,
        requestedAction: existing.requestedAction?.entry ?? null,
        selectedActions: input.selectedActions,
        currentPrincipal,
        approving: status === "approved",
      })
      const result = await decideActionLedgerApproval(input.db, {
        context: input.requestContext,
        id: approvalId,
        status,
        decidedByPrincipalId: currentPrincipal,
        actionName: "action-ledger.approval-decision",
        actionVersion: "v1",
        evaluatedRisk: status === "approved" ? "critical" : "high",
        targetType: "action_approval",
        targetId: approvalId,
        routeOrToolName: status === "approved" ? "approve_action_approval" : "deny_action_approval",
        capabilityId: "@voyant-travel/action-ledger#action.decide-approval",
        capabilityVersion: "v1",
        authorizationSource: "selected_graph_policy",
        idempotencyScope: `${approvalId}:decision`,
        idempotencyKey: status,
      })
      if (!result) {
        throw new ToolError(`Action approval "${approvalId}" was not found.`, "NOT_FOUND", {
          approvalId,
        })
      }
      return {
        approval: approvalDto(result.approval),
        decisionAction: entryDto(result.decisionAction),
      }
    },
  }
}

function selectedApprovalRequestAction(
  actions: readonly SelectedAction[],
  request: RequestActionApprovalToolInput,
): SelectedAction {
  const selected = actions.find(
    (action) => action.id === request.actionId && action.version === request.actionVersion,
  )
  if (!selected) {
    throw new ToolError(
      "The requested action is not selected in this deployment graph.",
      "AUTHORIZATION_DENIED",
      {
        actionId: request.actionId,
        actionVersion: request.actionVersion,
      },
    )
  }
  if (
    selected.kind !== "execute" ||
    selected.approval !== "required" ||
    !selected.from?.tools?.length ||
    (selected.allowedActorTypes?.length && !selected.allowedActorTypes.includes("staff"))
  ) {
    throw new ToolError(
      "The selected action is not a staff Tool write with an unconditional approval policy.",
      "AUTHORIZATION_DENIED",
      { actionId: selected.id, approval: selected.approval ?? "never" },
    )
  }
  return selected
}

function assertApprovalAuthority(input: {
  approval: ActionApproval
  requestedAction: ActionLedgerEntry | null
  selectedActions: readonly SelectedAction[]
  currentPrincipal: string
  approving: boolean
}): void {
  const requested = input.requestedAction
  const selected = requested
    ? input.selectedActions.find(
        (action) =>
          (action.capabilityId ?? action.id) === requested.capabilityId &&
          action.version === requested.capabilityVersion,
      )
    : undefined
  if (
    !requested ||
    !selected ||
    selected.kind !== "execute" ||
    (selected.approval !== "required" && selected.approval !== "conditional") ||
    (selected.allowedActorTypes?.length && !selected.allowedActorTypes.includes("staff"))
  ) {
    throw new ToolError(
      "The approval no longer resolves to a selected staff write policy.",
      "AUTHORIZATION_DENIED",
      { approvalId: input.approval.id, capabilityId: requested?.capabilityId ?? "missing" },
    )
  }
  if (
    input.approval.assignedToPrincipalId &&
    input.approval.assignedToPrincipalId !== input.currentPrincipal
  ) {
    throw new ToolError(
      "The approval is assigned to a different principal.",
      "AUTHORIZATION_DENIED",
      {
        approvalId: input.approval.id,
      },
    )
  }
  if (
    input.approving &&
    input.approval.expiresAt &&
    input.approval.expiresAt.getTime() <= Date.now()
  ) {
    throw new ToolError("Expired approvals cannot be approved.", "AUTHORIZATION_DENIED", {
      approvalId: input.approval.id,
    })
  }
}

function actionLedgerRequestContext(c: ActionLedgerMcpContext): ActionLedgerRequestContextValues {
  return {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiKeyId: c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? "staff",
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.get("correlationId") ?? null,
  }
}

function writePrincipal(context: ActionLedgerRequestContextValues): string {
  const principal = mapActionLedgerRequestContext(context)
  if (principal.principalId === "unknown_request") {
    throw new ToolError("A concrete authenticated principal is required.", "AUTHORIZATION_DENIED")
  }
  return principal.principalId
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value)
}

function entryDto(entry: ActionLedgerEntry): ActionLedgerEntryDto {
  return { ...entry, occurredAt: iso(entry.occurredAt), createdAt: iso(entry.createdAt) }
}

function approvalDto(row: ActionApproval): ActionApprovalDto {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    decidedAt: nullableIso(row.decidedAt),
    expiresAt: nullableIso(row.expiresAt),
  }
}

function delegationDto(row: ActionDelegation): ActionDelegationDto {
  return { ...row, createdAt: iso(row.createdAt), expiresAt: nullableIso(row.expiresAt) }
}

function payloadDto(row: ActionLedgerPayload) {
  return { ...row, createdAt: iso(row.createdAt), expiresAt: nullableIso(row.expiresAt) }
}

function entryDetailDto(result: {
  entry: ActionLedgerEntry
  mutationDetail: ActionMutationDetail | null
  sensitiveReadDetail: ActionSensitiveReadDetail | null
  payloads: ActionLedgerPayload[]
}): ActionLedgerEntryDetailDto {
  return {
    ...entryDto(result.entry),
    mutationDetail: result.mutationDetail,
    sensitiveReadDetail: result.sensitiveReadDetail,
    payloads: result.payloads.map(payloadDto),
  }
}

function approvalDetailDto(result: {
  approval: ActionApproval
  requestedAction: Parameters<typeof entryDetailDto>[0] | null
}): ActionApprovalDetailDto {
  return {
    ...approvalDto(result.approval),
    requestedAction: result.requestedAction ? entryDetailDto(result.requestedAction) : null,
  }
}
