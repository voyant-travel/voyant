import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { realtimeRuntimePort } from "./runtime-port.js"

export interface RealtimeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned registration map for Realtime deployment adapters. */
export function createRealtimeRuntimePortContribution(
  host: RealtimeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createRealtimeStandardNodeRuntime(host.primitives),
  )
  return { [realtimeRuntimePort.id]: runtime }
}
