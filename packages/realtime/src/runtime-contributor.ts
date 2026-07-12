import type { CreateRealtimeHonoModuleOptions } from "./index.js"
import { realtimeRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface RealtimeRuntimePortContribution {
  realtime: RuntimePortValue<CreateRealtimeHonoModuleOptions>
}

/** Package-owned registration map for Realtime deployment adapters. */
export function createRealtimeRuntimePortContribution(
  contribution: RealtimeRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [realtimeRuntimePort.id]: contribution.realtime }
}
