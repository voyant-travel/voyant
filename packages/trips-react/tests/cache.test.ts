import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { writePriceTripCache, writeTripCheckoutCache } from "../src/cache.js"
import { tripsQueryKeys } from "../src/query-keys.js"

describe("trips react cache helpers", () => {
  it("writes priced trip results into trip, component, and pricing caches", () => {
    const queryClient = new QueryClient()
    const result = {
      envelope: { id: "trip_123" },
      components: [{ id: "trcp_1" }],
      pricing: { totalAmountCents: 10900 },
      warnings: [],
      failures: [],
    } as never

    writePriceTripCache(queryClient, result)

    expect(queryClient.getQueryData(tripsQueryKeys.trip("trip_123"))).toEqual({
      envelope: { id: "trip_123" },
      components: [{ id: "trcp_1" }],
    })
    expect(queryClient.getQueryData(tripsQueryKeys.components("trip_123"))).toEqual([
      { id: "trcp_1" },
    ])
    expect(queryClient.getQueryData(tripsQueryKeys.pricing("trip_123"))).toEqual({
      totalAmountCents: 10900,
    })
  })

  it("writes checkout targets into the checkout cache", () => {
    const queryClient = new QueryClient()
    const result = {
      envelope: { id: "trip_123" },
      components: [],
      target: { envelopeId: "trip_123", checkoutUrl: "https://pay.example/trip_123" },
      componentCheckouts: [],
      failures: [],
      warnings: [],
    } as never

    writeTripCheckoutCache(queryClient, result)

    expect(queryClient.getQueryData(tripsQueryKeys.checkout("trip_123"))).toEqual({
      envelopeId: "trip_123",
      checkoutUrl: "https://pay.example/trip_123",
    })
  })
})
