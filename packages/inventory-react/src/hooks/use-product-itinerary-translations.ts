"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productItineraryTranslationListResponse } from "../schemas.js"

export interface UseProductItineraryTranslationsOptions {
  enabled?: boolean | undefined
}

export function useProductItineraryTranslations(
  productId: string | null | undefined,
  itineraryId: string | null | undefined,
  options: UseProductItineraryTranslationsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: productsQueryKeys.productItineraryTranslations(productId ?? "", itineraryId ?? ""),
    queryFn: () => {
      if (!productId || !itineraryId) {
        throw new Error("useProductItineraryTranslations requires a productId and itineraryId")
      }

      return fetchWithValidation(
        `/v1/products/${productId}/itineraries/${itineraryId}/translations`,
        productItineraryTranslationListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(productId) && Boolean(itineraryId),
  })
}
