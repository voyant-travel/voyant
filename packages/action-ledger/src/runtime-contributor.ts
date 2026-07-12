import type { ActionLedgerHealthRoutesOptions } from "./health-routes.js"
import { actionLedgerHealthRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface ActionLedgerRuntimePortContribution {
  health: RuntimePortValue<ActionLedgerHealthRoutesOptions>
}

/** Package-owned registration map for Action Ledger deployment adapters. */
export function createActionLedgerRuntimePortContribution(
  contribution: ActionLedgerRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [actionLedgerHealthRuntimePort.id]: contribution.health }
}
