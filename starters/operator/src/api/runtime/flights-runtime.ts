import type { FlightsRuntime } from "@voyant-travel/flights"
import { createDemoFlightAdapter } from "@voyant-travel/plugin-flights-demo"

import { cardPaymentStarter } from "./card-payment"

/** Generic Node-host providers consumed by the Flights package runtime port. */
export const operatorFlightsRuntime: FlightsRuntime = {
  resolveAdapter(c) {
    const baseUrl = (c.env as { FLIGHTS_DEMO_API_URL?: string }).FLIGHTS_DEMO_API_URL
    if (!baseUrl) {
      throw new Error(
        "FLIGHTS_DEMO_API_URL is not set. Start the demo service with `pnpm --dir apps/flights-demo-api dev` and point this env at it (e.g. http://localhost:3320).",
      )
    }
    return createDemoFlightAdapter({ baseUrl })
  },
  async startCardPayment(c, sessionId, billing) {
    await cardPaymentStarter(c, {
      db: c.var.db,
      sessionId,
      billing,
      description: `Flight ${sessionId}`,
    })
  },
}
