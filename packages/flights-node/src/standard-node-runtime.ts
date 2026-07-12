import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { CardPaymentStarter } from "@voyant-travel/finance/card-payment"
import type { FlightsRuntime } from "@voyant-travel/flights"
import { lazyProvider } from "@voyant-travel/hono"
import { createDemoFlightAdapter } from "@voyant-travel/plugin-flights-demo"

const cardPaymentStarter: CardPaymentStarter = lazyProvider(async () =>
  import("@voyant-travel/plugin-netopia").then((module) => module.netopiaCardPaymentStarter()),
)
type CardPaymentInput = Parameters<CardPaymentStarter>[1]

/** Build the standard Node Flights runtime from domain-neutral host primitives. */
export function createFlightsStandardNodeRuntime(
  primitives: VoyantRuntimeHostPrimitives,
): FlightsRuntime {
  return {
    resolveAdapter(c) {
      const baseUrl = stringValue(primitives.env(c.env).FLIGHTS_DEMO_API_URL)
      if (!baseUrl) {
        throw new Error(
          "FLIGHTS_DEMO_API_URL is not set. Start the demo service with `pnpm --dir apps/flights-demo-api dev` and point this env at it (e.g. http://localhost:3320).",
        )
      }
      return createDemoFlightAdapter({ baseUrl })
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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}
