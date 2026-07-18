import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { appsManagedAuthRuntimePort } from "./runtime-port.js"

export interface AppsRuntimeContributorHost {
  primitives: Pick<VoyantRuntimeHostPrimitives, "config">
  hasRuntimePort?(port: { id: string }): boolean
}

/**
 * Managed installation contracts are host authority and cannot be reconstructed
 * from scalar environment values. Hosts contribute `apps.managed-auth`
 * explicitly; self-hosted runtimes keep the port absent.
 */
export function createAppsRuntimePortContribution(
  host: AppsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  if (host.hasRuntimePort?.(appsManagedAuthRuntimePort)) return {}
  return {}
}
