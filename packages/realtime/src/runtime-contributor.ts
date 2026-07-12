import type { CreateRealtimeHonoModuleOptions } from "./index.js"
import { realtimeRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface RealtimeRuntimeContributorHost {
  capabilities: {
    loadRealtimeRuntime(): RuntimePortValue<CreateRealtimeHonoModuleOptions>
  }
}

/** Package-owned registration map for Realtime deployment adapters. */
export function createRealtimeRuntimePortContribution(
  host: RealtimeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return { [realtimeRuntimePort.id]: host.capabilities.loadRealtimeRuntime() }
}
