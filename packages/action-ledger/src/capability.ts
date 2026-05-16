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
  evaluateRisk?: (context: TContext) => ActionLedgerCapabilityRisk
}

export interface ActionLedgerCapabilityRegistry<
  TDefinition extends ActionLedgerCapabilityDefinition = ActionLedgerCapabilityDefinition,
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

const riskRank: Record<ActionLedgerCapabilityRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

export function createActionLedgerCapabilityRegistry<
  const TDefinition extends ActionLedgerCapabilityDefinition,
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

export function getActionLedgerCapability<TDefinition extends ActionLedgerCapabilityDefinition>(
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

export function actionLedgerCapabilityKey(id: string, version: string): string {
  return `${id}@${version}`
}
