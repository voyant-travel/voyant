import { createRealtimeRuntime } from "./runtime.js"
import { realtimeRuntimePort, realtimeTransportRuntimePort } from "./runtime-port.js"
import type { RealtimeProvider } from "./types.js"

export interface RealtimeRuntimeContributorHost {
  hasRuntimePort?(port: { id: string }): boolean
  getRuntimePort<T>(port: { id: string }): T | Promise<T>
}

/** Package-owned Realtime runtime registration map. */
export function createRealtimeRuntimePortContribution(
  host: RealtimeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const hasTransport = host.hasRuntimePort?.(realtimeTransportRuntimePort) ?? false
  if (!hasTransport) {
    return { [realtimeRuntimePort.id]: createRealtimeRuntime(null) }
  }

  const transport = host.getRuntimePort<RealtimeProvider>(realtimeTransportRuntimePort)
  if (transport instanceof Promise) {
    throw new TypeError(
      "realtime.transport must be available synchronously to runtime contributors.",
    )
  }
  return { [realtimeRuntimePort.id]: createRealtimeRuntime(transport) }
}
