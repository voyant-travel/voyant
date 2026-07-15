import { defineToolContextContribution, requireService } from "@voyant-travel/tools"
import type { Context } from "hono"

import { flightsRuntimePort } from "./runtime-port.js"
import { requireFlightCapabilityMethod } from "./tools.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["flights"],
  contribute: ({ request, resources }) => {
    const c = request as Context
    const runtime = requireService(
      resources[flightsRuntimePort.id] as import("./runtime-port.js").FlightsRuntime | undefined,
      flightsRuntimePort.id,
    )
    const adapter = runtime.resolveAdapter(c)
    const adapterContext = {
      connectionId: "mcp",
      correlationId: c.req.header("x-request-id") ?? undefined,
    }
    return {
      flights: {
        searchFlights: (input: Parameters<typeof adapter.searchFlights>[1]) =>
          adapter.searchFlights(adapterContext, input),
        priceOffer: (input: Parameters<typeof adapter.priceOffer>[1]) =>
          adapter.priceOffer(adapterContext, input),
        listOrders: (
          input: NonNullable<typeof adapter.listOrders> extends (...args: infer P) => unknown
            ? P[1]
            : never,
        ) =>
          requireFlightCapabilityMethod(adapter.listOrders?.bind(adapter), "listOrders")(
            adapterContext,
            input,
          ),
        getOrder: (orderId: string) => adapter.getOrder(adapterContext, orderId),
        ticketOrder: (orderId: string) =>
          requireFlightCapabilityMethod(adapter.ticketOrder?.bind(adapter), "ticketOrder")(
            adapterContext,
            orderId,
          ),
        cancelOrder: ({
          orderId,
          reason,
        }: {
          orderId: string
          reason?: Parameters<typeof adapter.cancelOrder>[2]
        }) => adapter.cancelOrder(adapterContext, orderId, reason),
      },
    }
  },
})
