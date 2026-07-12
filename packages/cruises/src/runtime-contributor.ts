import { type CruisesRoutesRuntime, cruisesRoutesRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface CruisesRuntimePortContribution {
  cruisesRoutes: RuntimePortValue<CruisesRoutesRuntime>
}

export interface CruisesRuntimeContributorHost {
  capabilities: {
    resolveCruiseSourceAdapterRegistry: CruisesRoutesRuntime["resolveSourceAdapterRegistry"]
  }
}

/** Package-owned registration map for Cruises deployment adapters. */
export function createCruisesRuntimePortContribution(
  host: CruisesRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const cruisesRoutes: CruisesRoutesRuntime = {
    resolveSourceAdapterRegistry: host.capabilities.resolveCruiseSourceAdapterRegistry,
  }
  return { [cruisesRoutesRuntimePort.id]: cruisesRoutes }
}
