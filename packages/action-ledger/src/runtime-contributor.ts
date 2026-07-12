import type { ActionLedgerHealthRoutesOptions } from "./health-routes.js"
import { actionLedgerHealthRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface ActionLedgerRuntimePortContribution {
  health: RuntimePortValue<ActionLedgerHealthRoutesOptions>
}

export interface ActionLedgerRuntimeContributorHost {
  capabilities: {
    loadActionLedgerHealthRuntime(): RuntimePortValue<ActionLedgerHealthRoutesOptions>
  }
}

/** Package-owned registration map for Action Ledger deployment adapters. */
export function createActionLedgerRuntimePortContribution(
  host: ActionLedgerRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [actionLedgerHealthRuntimePort.id]: host.capabilities.loadActionLedgerHealthRuntime(),
  }
}
