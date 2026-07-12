import { type FlightsRuntime, flightsRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface FlightsRuntimeContributorHost {
  capabilities: {
    loadFlightsRuntime(): RuntimePortValue<FlightsRuntime>
  }
}

/** Package-owned registration map for Flights deployment adapters. */
export function createFlightsRuntimePortContribution(
  host: FlightsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return { [flightsRuntimePort.id]: host.capabilities.loadFlightsRuntime() }
}
