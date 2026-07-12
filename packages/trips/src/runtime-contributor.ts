import type { TripsRoutesOptionsProvider } from "./routes.js"
import {
  type TripsDatabaseRuntime,
  tripsDatabaseRuntimePort,
  tripsRoutesRuntimePort,
} from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface TripsRuntimePortContribution {
  routes: RuntimePortValue<TripsRoutesOptionsProvider>
  database: RuntimePortValue<TripsDatabaseRuntime>
}

/** Package-owned registration map for Trips deployment adapters. */
export function createTripsRuntimePortContribution(
  contribution: TripsRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [tripsRoutesRuntimePort.id]: contribution.routes,
    [tripsDatabaseRuntimePort.id]: contribution.database,
  }
}
