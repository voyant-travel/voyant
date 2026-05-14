"use client"

import { useMutation } from "@tanstack/react-query"

import { applyStorefrontOffer } from "../operations.js"
import { useVoyantStorefrontContext } from "../provider.js"
import type { StorefrontOfferApplyInput } from "../schemas.js"

export function useStorefrontOfferApplyMutation(slug: string | null | undefined) {
  const { baseUrl, fetcher } = useVoyantStorefrontContext()

  return useMutation({
    mutationFn: async (input: StorefrontOfferApplyInput) => {
      if (!slug) {
        throw new Error("useStorefrontOfferApplyMutation requires a slug")
      }

      return applyStorefrontOffer({ baseUrl, fetcher }, slug, input)
    },
  })
}
