import { type FlightsRuntime, flightsRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface FlightsRuntimePortContribution {
  flights: RuntimePortValue<FlightsRuntime>
}

/** Package-owned registration map for Flights deployment adapters. */
export function createFlightsRuntimePortContribution(
  contribution: FlightsRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [flightsRuntimePort.id]: contribution.flights }
}
