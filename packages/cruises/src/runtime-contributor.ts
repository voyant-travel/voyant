import { type CruisesRoutesRuntime, cruisesRoutesRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface CruisesRuntimePortContribution {
  routes: RuntimePortValue<CruisesRoutesRuntime>
}

/** Package-owned registration map for Cruises deployment adapters. */
export function createCruisesRuntimePortContribution(
  contribution: CruisesRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [cruisesRoutesRuntimePort.id]: contribution.routes }
}
