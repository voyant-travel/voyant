"use client"

import { useMutation } from "@tanstack/react-query"

import { redeemStorefrontOffer } from "../operations.js"
import { useVoyantStorefrontContext } from "../provider.js"
import type { StorefrontOfferRedeemInput } from "../schemas.js"

export function useStorefrontOfferRedeemMutation() {
  const { baseUrl, fetcher } = useVoyantStorefrontContext()

  return useMutation({
    mutationFn: async (input: StorefrontOfferRedeemInput) => {
      return redeemStorefrontOffer({ baseUrl, fetcher }, input)
    },
  })
}
