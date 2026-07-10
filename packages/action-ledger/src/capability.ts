import type { ActionLedgerEntry } from "./schema.js"

export const actionLedgerCapabilityLedgerPolicyValues = ["none", "optional", "required"] as const
export const actionLedgerCapabilityApprovalPolicyValues = [
  "none",
  "conditional",
  "required",
] as const

export type ActionLedgerCapabilityRisk = ActionLedgerEntry["evaluatedRisk"]
export type ActionLedgerCapabilityLedgerPolicy =
  (typeof actionLedgerCapabilityLedgerPolicyValues)[number]
export type ActionLedgerCapabilityApprovalPolicy =
  (typeof actionLedgerCapabilityApprovalPolicyValues)[number]

export interface ActionLedgerCapabilityGrant {
  resource: string
  action: string
}

export interface ActionLedgerCapabilityDefinition<TContext = unknown> {
  id: string
  version: string
  resource: string
  action: string
  risk: ActionLedgerCapabilityRisk
  ledgerPolicy: ActionLedgerCapabilityLedgerPolicy
  approvalPolicy?: ActionLedgerCapabilityApprovalPolicy
  reversible?: boolean
  allowedActorTypes?: readonly string[]
  requiredGrants?: readonly ActionLedgerCapabilityGrant[]
  evaluateRisk?: (context: TContext) => ActionLedgerCapabilityRisk
}

export interface ActionLedgerCapabilityRegistry<
  TDefinition extends ActionLedgerCapabilityDefinition<never> = ActionLedgerCapabilityDefinition,
> {
  definitions: readonly TDefinition[]
  byKey: ReadonlyMap<string, TDefinition>
}

export class ActionLedgerCapabilityRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActionLedgerCapabilityRegistryError"
  }
}

export interface EvaluateActionLedgerCapabilityAccessInput<TContext = unknown> {
  definition: ActionLedgerCapabilityDefinition<TContext>
  actor?: string | null
  callerType?: string | null
  scopes?: readonly string[] | null
  permissions?: Record<string, readonly string[]> | null
  isInternalRequest?: boolean | null
  riskContext?: TContext
}

export type ActionLedgerCapabilityAccessReason =
  | "internal_request"
  | "scope_grant"
  | "permission_grant"
  | "actor_allowed"
  | "actor_missing"
  | "actor_not_allowed"
  | "grant_missing"

export interface ActionLedgerCapabilityAccessResult {
  allowed: boolean
  reason: ActionLedgerCapabilityAccessReason
  capabilityId: string
  capabilityVersion: string
  evaluatedRisk: ActionLedgerCapabilityRisk
  ledgerPolicy: ActionLedgerCapabilityLedgerPolicy
  approvalPolicy: ActionLedgerCapabilityApprovalPolicy
  authorizationSource: string
  grant: ActionLedgerCapabilityGrant | null
}

export type ActionLedgerApprovalRequirementReason =
  | "access_denied"
  | "policy_none"
  | "policy_required"
  | "conditional_policy_required"
  | "conditional_policy_not_required"

export interface EvaluateActionLedgerApprovalRequirementInput {
  access: ActionLedgerCapabilityAccessResult
  conditionalApprovalRequired?: boolean | null
  reasonCode?: string | null
}

export interface ActionLedgerApprovalRequirementResult {
  required: boolean
  reason: ActionLedgerApprovalRequirementReason
  approvalPolicy: ActionLedgerCapabilityApprovalPolicy
  capabilityId: string
  capabilityVersion: string
  evaluatedRisk: ActionLedgerCapabilityRisk
  reasonCode: string | null
}

const riskRank: Record<ActionLedgerCapabilityRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

export function createActionLedgerCapabilityRegistry<
  const TDefinition extends ActionLedgerCapabilityDefinition<never>,
>(definitions: readonly TDefinition[]): ActionLedgerCapabilityRegistry<TDefinition> {
  const byKey = new Map<string, TDefinition>()

  for (const definition of definitions) {
    const key = actionLedgerCapabilityKey(definition.id, definition.version)
    if (byKey.has(key)) {
      throw new ActionLedgerCapabilityRegistryError(
        `Duplicate action ledger capability ${definition.id}@${definition.version}`,
      )
    }
    byKey.set(key, definition)
  }

  return { definitions, byKey }
}

export function getActionLedgerCapability<
  TDefinition extends ActionLedgerCapabilityDefinition<never>,
>(
  registry: ActionLedgerCapabilityRegistry<TDefinition>,
  id: string,
  version: string,
): TDefinition | null {
  return registry.byKey.get(actionLedgerCapabilityKey(id, version)) ?? null
}

export function evaluateActionLedgerCapabilityRisk<TContext>(
  definition: ActionLedgerCapabilityDefinition<TContext>,
  context: TContext,
): ActionLedgerCapabilityRisk {
  const evaluatedRisk = definition.evaluateRisk?.(context) ?? definition.risk
  return riskRank[evaluatedRisk] > riskRank[definition.risk] ? evaluatedRisk : definition.risk
}

export function evaluateActionLedgerCapabilityAccess<TContext = unknown>(
  input: EvaluateActionLedgerCapabilityAccessInput<TContext>,
): ActionLedgerCapabilityAccessResult {
  const { definition } = input
  const evaluatedRisk =
    "riskContext" in input
      ? evaluateActionLedgerCapabilityRisk(definition, input.riskContext as TContext)
      : definition.risk
  const base = {
    capabilityId: definition.id,
    capabilityVersion: definition.version,
    evaluatedRisk,
    ledgerPolicy: definition.ledgerPolicy,
    approvalPolicy: definition.approvalPolicy ?? "none",
  }

  if (input.isInternalRequest || input.callerType === "internal") {
    return {
      ...base,
      allowed: true,
      reason: "internal_request",
      authorizationSource: "internal_request",
      grant: null,
    }
  }

  const grant = findSatisfiedGrant(definition, input)
  if (grant) {
    return {
      ...base,
      allowed: true,
      reason: grant.source,
      authorizationSource: grant.source === "scope_grant" ? "scope" : "api_token_permission",
      grant: grant.grant,
    }
  }

  if (definition.requiredGrants && definition.requiredGrants.length > 0) {
    return {
      ...base,
      allowed: false,
      reason: "grant_missing",
      authorizationSource: input.callerType === "api_key" ? "api_token_permission" : "scope",
      grant: null,
    }
  }

  if (input.callerType === "api_key") {
    return {
      ...base,
      allowed: false,
      reason: "grant_missing",
      authorizationSource: "api_token_permission",
      grant: null,
    }
  }

  const actor = normalizeNullableString(input.actor)
  if (!actor) {
    return {
      ...base,
      allowed: false,
      reason: "actor_missing",
      authorizationSource: "actor_context",
      grant: null,
    }
  }

  if (
    definition.allowedActorTypes &&
    definition.allowedActorTypes.length > 0 &&
    !definition.allowedActorTypes.includes(actor)
  ) {
    return {
      ...base,
      allowed: false,
      reason: "actor_not_allowed",
      authorizationSource: "actor_context",
      grant: null,
    }
  }

  return {
    ...base,
    allowed: true,
    reason: "actor_allowed",
    authorizationSource: "actor_context",
    grant: null,
  }
}

export function evaluateActionLedgerApprovalRequirement(
  input: EvaluateActionLedgerApprovalRequirementInput,
): ActionLedgerApprovalRequirementResult {
  const base = {
    approvalPolicy: input.access.approvalPolicy,
    capabilityId: input.access.capabilityId,
    capabilityVersion: input.access.capabilityVersion,
    evaluatedRisk: input.access.evaluatedRisk,
    reasonCode: normalizeNullableString(input.reasonCode),
  }

  if (!input.access.allowed) {
    return {
      ...base,
      required: false,
      reason: "access_denied",
    }
  }

  if (input.access.approvalPolicy === "required") {
    return {
      ...base,
      required: true,
      reason: "policy_required",
    }
  }

  if (input.access.approvalPolicy === "conditional") {
    return {
      ...base,
      required: input.conditionalApprovalRequired === true,
      reason:
        input.conditionalApprovalRequired === true
          ? "conditional_policy_required"
          : "conditional_policy_not_required",
    }
  }

  return {
    ...base,
    required: false,
    reason: "policy_none",
  }
}

export function actionLedgerCapabilityKey(id: string, version: string): string {
  return `${id}@${version}`
}

function findSatisfiedGrant<TContext>(
  definition: ActionLedgerCapabilityDefinition<TContext>,
  input: Pick<EvaluateActionLedgerCapabilityAccessInput<TContext>, "permissions" | "scopes">,
): { source: "scope_grant" | "permission_grant"; grant: ActionLedgerCapabilityGrant } | null {
  for (const grant of grantsForCapability(definition)) {
    if (hasScopeGrant(input.scopes, grant)) {
      return { source: "scope_grant", grant }
    }
    if (hasPermissionGrant(input.permissions, grant)) {
      return { source: "permission_grant", grant }
    }
  }

  return null
}

function grantsForCapability<TContext>(
  definition: ActionLedgerCapabilityDefinition<TContext>,
): readonly ActionLedgerCapabilityGrant[] {
  if (definition.requiredGrants && definition.requiredGrants.length > 0) {
    return definition.requiredGrants
  }

  return [{ resource: definition.resource, action: definition.action }]
}

function hasPermissionGrant(
  permissions: Record<string, readonly string[]> | null | undefined,
  grant: ActionLedgerCapabilityGrant,
): boolean {
  if (!permissions) return false
  return hasGrant(permissions, grant)
}

function hasScopeGrant(
  scopes: readonly string[] | null | undefined,
  grant: ActionLedgerCapabilityGrant,
): boolean {
  if (!scopes || scopes.length === 0) return false
  const permissions: Record<string, string[]> = {}

  for (const scope of scopes) {
    const normalized = normalizeNullableString(scope)
    if (!normalized) continue

    if (normalized === "*") {
      permissions["*"] = ["*"]
      continue
    }

    const [resource, action] = normalized.split(":", 2)
    if (!resource || !action) continue
    permissions[resource] = [...(permissions[resource] ?? []), action]
  }

  return hasGrant(permissions, grant)
}

function hasGrant(
  permissions: Record<string, readonly string[]>,
  grant: ActionLedgerCapabilityGrant,
): boolean {
  return (
    permissions["*"]?.includes("*") === true ||
    permissions["*"]?.includes(grant.action) === true ||
    permissions[grant.resource]?.includes("*") === true ||
    permissions[grant.resource]?.includes(grant.action) === true
  )
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") return null
  return value
}
