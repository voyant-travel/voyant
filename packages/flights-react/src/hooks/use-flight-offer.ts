"use client"

import { useMutation } from "@tanstack/react-query"
import type { FlightOffer } from "@voyant-travel/flights/contract/types"

import { fetchWithValidation } from "../client.js"
import { useVoyantFlightsContext } from "../provider.js"
import { type FlightPriceResponseDto, flightPriceResponseSchema } from "../schemas.js"

export interface PriceOfferInput {
  offerId: string
  /** Some adapters require the offer payload echoed back. */
  offer?: FlightOffer
}

/**
 * POST `/v1/admin/flights/price` — re-prices an offer immediately before
 * booking. Returns `{ offer, valid, invalidReason? }`. The mutation shape
 * fits the typical "user clicks Continue → re-price → if invalid, show
 * banner; if valid, proceed to booking" flow.
 */
export function useFlightOfferPrice() {
  const client = useVoyantFlightsContext()
  return useMutation<FlightPriceResponseDto, Error, PriceOfferInput>({
    mutationFn: (input) =>
      fetchWithValidation("/v1/admin/flights/price", flightPriceResponseSchema, client, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  })
}
