import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { CardPaymentStarter } from "@voyant-travel/finance/card-payment"
import type { FlightsRuntime } from "./runtime-port.js"

let cardPaymentStarterPromise: Promise<CardPaymentStarter | null> | undefined

function resolveCardPaymentStarter(): Promise<CardPaymentStarter | null> {
  cardPaymentStarterPromise ??= import("@voyant-travel/plugin-netopia")
    .then((module) => module.netopiaCardPaymentStarter())
    .catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ERR_MODULE_NOT_FOUND" &&
        /Cannot find (?:package|module) ['"]@voyant-travel\/plugin-netopia['"]/.test(error.message)
      ) {
        return null
      }
      throw error
    })
  return cardPaymentStarterPromise
}

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
      const cardPaymentStarter = await resolveCardPaymentStarter()
      if (!cardPaymentStarter) return
      await cardPaymentStarter(c, {
        db: primitives.database.fromContext<CardPaymentInput["db"]>(c),
        sessionId,
        billing,
        description: `Flight ${sessionId}`,
      })
    },
  }
}
