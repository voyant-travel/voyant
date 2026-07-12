import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { CardPaymentStarter } from "@voyant-travel/finance/card-payment"
import { lazyProvider } from "@voyant-travel/hono"
import type { FlightsRuntime } from "./runtime-port.js"

const cardPaymentStarter: CardPaymentStarter = lazyProvider(async () =>
  import("@voyant-travel/plugin-netopia").then((module) => module.netopiaCardPaymentStarter()),
)
type CardPaymentInput = Parameters<CardPaymentStarter>[1]

/** Build the standard Node Flights runtime from domain-neutral host primitives. */
export function createFlightsRuntime(primitives: VoyantRuntimeHostPrimitives): FlightsRuntime {
  return {
    resolveAdapter() {
      throw new Error(
        "Flight connector is not configured. Provide a flights.runtime port from project customization or an installed connector integration.",
      )
    },
    async startCardPayment(c, sessionId, billing) {
      await cardPaymentStarter(c, {
        db: primitives.database.fromContext<CardPaymentInput["db"]>(c),
        sessionId,
        billing,
        description: `Flight ${sessionId}`,
      })
    },
  }
}
