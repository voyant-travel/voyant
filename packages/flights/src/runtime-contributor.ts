import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { flightsRuntimePort } from "./runtime-port.js"

export interface FlightsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Contribute the standard Node Flights runtime selected by the framework BOM. */
export function createFlightsRuntimePortContribution(
  host: FlightsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./runtime.js").then((module) =>
    module.createFlightsRuntime(host.primitives),
  )
  return { [flightsRuntimePort.id]: runtime }
}
