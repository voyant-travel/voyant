import type { SmartbillRuntimeHost } from "./graph-runtime.js"
import { smartbillRuntimeHostPort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface SmartbillRuntimePortContribution {
  host: RuntimePortValue<SmartbillRuntimeHost>
}

/** Package-owned registration map for deployment-supplied SmartBill host dependencies. */
export function createSmartbillRuntimePortContribution(
  contribution: SmartbillRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [smartbillRuntimeHostPort.id]: contribution.host }
}
