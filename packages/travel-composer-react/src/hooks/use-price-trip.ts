"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { writePriceTripCache } from "../cache.js"
import { type PriceTripBody, priceTrip } from "../operations.js"
import { useVoyantTravelComposerContext } from "../provider.js"

export function usePriceTrip(envelopeId: string | null | undefined) {
  const { baseUrl, fetcher } = useVoyantTravelComposerContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: PriceTripBody) => {
      if (!envelopeId) throw new Error("usePriceTrip requires an envelopeId")
      return priceTrip({ baseUrl, fetcher }, envelopeId, input)
    },
    onSuccess: (result) => writePriceTripCache(queryClient, result),
  })
}
