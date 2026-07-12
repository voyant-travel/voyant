import { type MiceRuntime, miceRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface MiceRuntimePortContribution {
  mice: RuntimePortValue<MiceRuntime>
}

/** Package-owned registration map for MICE deployment adapters. */
export function createMiceRuntimePortContribution(
  contribution: MiceRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [miceRuntimePort.id]: contribution.mice }
}
