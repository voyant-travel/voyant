import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { flightsRuntimePort } from "@voyant-travel/flights"

export interface FlightsNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute the standard Node Flights adapter selected by the framework BOM. */
export function createFlightsNodeRuntimePortContribution(
  host: FlightsNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createFlightsStandardNodeRuntime(host.primitives),
  )
  return { [flightsRuntimePort.id]: runtime }
}
