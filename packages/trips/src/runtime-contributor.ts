import type { TripsRoutesOptionsProvider } from "./routes.js"
import {
  type TripsDatabaseRuntime,
  tripsDatabaseRuntimePort,
  tripsRoutesRuntimePort,
} from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface TripsRuntimePortContribution {
  tripsRoutes: RuntimePortValue<TripsRoutesOptionsProvider>
  tripsDatabase: RuntimePortValue<TripsDatabaseRuntime>
}

/** Package-owned registration map for Trips deployment adapters. */
export function createTripsRuntimePortContribution(
  contribution: TripsRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [tripsRoutesRuntimePort.id]: contribution.tripsRoutes,
    [tripsDatabaseRuntimePort.id]: contribution.tripsDatabase,
  }
}
