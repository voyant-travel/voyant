import { definePort } from "@voyant-travel/core/project"
import type { Context } from "hono"

import type { FlightConnectorAdapter } from "./contract/adapter.js"
import type { FlightCardBilling } from "./payment-integration.js"

/** Node-host behavior required by the package-owned Flights runtime factory. */
export interface FlightsRuntime {
  resolveAdapter(c: Context): FlightConnectorAdapter
  startCardPayment(c: Context, sessionId: string, billing: FlightCardBilling): Promise<void>
}

/** Typed deployment contract for connector and card-provider resolution. */
export const flightsRuntimePort = definePort<FlightsRuntime>({
  id: "flights.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("flights.runtime provider must be an options object.")
    }
    for (const method of ["resolveAdapter", "startCardPayment"] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`flights.runtime provider must implement ${method}().`)
      }
    }
  },
})
