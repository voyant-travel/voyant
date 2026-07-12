import { type CruisesRoutesRuntime, cruisesRoutesRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface CruisesRuntimePortContribution {
  cruisesRoutes: RuntimePortValue<CruisesRoutesRuntime>
}

export interface CruisesRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned registration map for Cruises deployment adapters. */
export function createCruisesRuntimePortContribution(
  host: CruisesRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const cruisesRoutes: CruisesRoutesRuntime = {
    resolveSourceAdapterRegistry: (bindings) =>
      import("@voyant-travel/catalog/standard-node/booking-engine-runtime").then((runtime) =>
        runtime.ensureBookingEngineRegistry(host.primitives.env(bindings)),
      ),
  }
  return { [cruisesRoutesRuntimePort.id]: cruisesRoutes }
}

import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
