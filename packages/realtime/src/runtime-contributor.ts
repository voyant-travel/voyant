import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { createRealtimeRuntime } from "./runtime.js"
import { realtimeRuntimePort } from "./runtime-port.js"

export interface RealtimeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned Realtime runtime registration map. */
export function createRealtimeRuntimePortContribution(
  host: RealtimeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return { [realtimeRuntimePort.id]: createRealtimeRuntime(host.primitives) }
}
