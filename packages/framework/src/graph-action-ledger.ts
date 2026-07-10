import {
  type ActionLedgerCapabilityDefinition,
  type ActionLedgerCapabilityRegistry,
  type ActionLedgerCapabilityRisk,
  actionLedgerCapabilityKey,
  createActionLedgerCapabilityRegistry,
} from "@voyant-travel/action-ledger/capability"

import type {
  VoyantGraphRuntime,
  VoyantGraphRuntimeActionDefinition,
  VoyantGraphRuntimeSelectedIds,
} from "./runtime-lowering.js"

export type VoyantGraphActionRiskEvaluator<TContext = unknown> = (
  context: TContext,
) => ActionLedgerCapabilityRisk

export interface LowerVoyantGraphActionsOptions<TContext = unknown> {
  /**
   * Runtime-only behavior that cannot be serialized in a package manifest.
   * Keys use the action-ledger `id@version` form.
   */
  riskEvaluators?: Readonly<Record<string, VoyantGraphActionRiskEvaluator<TContext>>>
}

/**
 * Lower exactly the actions selected by a generated graph into the shared
 * action-ledger registry contract. Graph scopes become required grants; the
 * target type and terminal action-id segment provide the registry resource and
 * action metadata.
 */
export function lowerVoyantGraphActionsToActionLedgerRegistry<TContext = unknown>(
  runtime: VoyantGraphRuntime,
  options: LowerVoyantGraphActionsOptions<TContext> = {},
): ActionLedgerCapabilityRegistry<ActionLedgerCapabilityDefinition<TContext>> {
  validateSelectedGraphActions(runtime)

  const definitions = runtime.actions
    .map((action) => lowerAction(action, options.riskEvaluators))
    .sort(
      (left, right) => left.id.localeCompare(right.id) || left.version.localeCompare(right.version),
    )

  return createActionLedgerCapabilityRegistry(definitions)
}

function lowerAction<TContext>(
  action: VoyantGraphRuntimeActionDefinition,
  riskEvaluators: LowerVoyantGraphActionsOptions<TContext>["riskEvaluators"],
): ActionLedgerCapabilityDefinition<TContext> {
  const evaluator = riskEvaluators?.[actionLedgerCapabilityKey(action.id, action.version)]
  return {
    id: action.id,
    version: action.version,
    resource: action.targetType,
    action: actionOperation(action),
    risk: action.risk,
    ledgerPolicy: action.ledger,
    approvalPolicy:
      action.approval === "conditional" || action.approval === "required"
        ? action.approval
        : "none",
    ...(action.reversible !== undefined ? { reversible: action.reversible } : {}),
    ...(action.requiredScopes.length > 0
      ? { requiredGrants: action.requiredScopes.map(scopeToGrant) }
      : {}),
    ...(evaluator ? { evaluateRisk: evaluator } : {}),
  }
}

function validateSelectedGraphActions(runtime: VoyantGraphRuntime): void {
  const scopes = new Set(runtime.accessScopes)
  const selectedIds = selectedIdSets(runtime.selectedIds)

  for (const action of runtime.actions) {
    for (const scope of action.requiredScopes) {
      if (!scopes.has(scope)) {
        throw new Error(
          `lowerVoyantGraphActionsToActionLedgerRegistry: action "${action.id}" requires undeclared selected-graph scope "${scope}".`,
        )
      }
    }

    for (const [binding, ids] of Object.entries(action.from) as Array<
      [keyof VoyantGraphRuntimeSelectedIds, readonly string[]]
    >) {
      for (const id of ids) {
        if (!selectedIds[binding].has(id)) {
          throw new Error(
            `lowerVoyantGraphActionsToActionLedgerRegistry: action "${action.id}" binds unknown selected-graph ${binding} id "${id}".`,
          )
        }
      }
    }
  }
}

function selectedIdSets(selectedIds: VoyantGraphRuntimeSelectedIds): {
  [K in keyof VoyantGraphRuntimeSelectedIds]: ReadonlySet<string>
} {
  return {
    routes: new Set(selectedIds.routes),
    tools: new Set(selectedIds.tools),
    workflows: new Set(selectedIds.workflows),
    events: new Set(selectedIds.events),
    webhooks: new Set(selectedIds.webhooks),
  }
}

function scopeToGrant(scope: string): { resource: string; action: string } {
  const separator = scope.indexOf(":")
  return {
    resource: scope.slice(0, separator),
    action: scope.slice(separator + 1),
  }
}

function actionOperation(action: VoyantGraphRuntimeActionDefinition): string {
  if (action.kind === "read" || action.kind === "sensitive-read") return "read"
  const segments = action.id.split(/[.:#]/).filter(Boolean)
  const terminal = segments.at(-1)
  return terminal?.startsWith("action-")
    ? terminal.slice("action-".length)
    : (terminal ?? "execute")
}
