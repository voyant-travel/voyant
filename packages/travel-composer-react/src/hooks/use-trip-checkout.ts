"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { writeTripCheckoutCache } from "../cache.js"
import { type StartTripCheckoutBody, startTripCheckout } from "../operations.js"
import { useVoyantTravelComposerContext } from "../provider.js"

export function useTripCheckout(envelopeId: string | null | undefined) {
  const { baseUrl, fetcher } = useVoyantTravelComposerContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: StartTripCheckoutBody) => {
      if (!envelopeId) throw new Error("useTripCheckout requires an envelopeId")
      return startTripCheckout({ baseUrl, fetcher }, envelopeId, input)
    },
    onSuccess: (result) => writeTripCheckoutCache(queryClient, result),
  })
}
