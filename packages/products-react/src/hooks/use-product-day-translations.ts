"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productDayTranslationListResponse } from "../schemas.js"

export interface UseProductDayTranslationsOptions {
  enabled?: boolean | undefined
}

export function useProductDayTranslations(
  productId: string | null | undefined,
  dayId: string | null | undefined,
  options: UseProductDayTranslationsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: productsQueryKeys.productDayTranslations(productId ?? "", dayId ?? ""),
    queryFn: () => {
      if (!productId || !dayId) {
        throw new Error("useProductDayTranslations requires a productId and dayId")
      }

      return fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/translations`,
        productDayTranslationListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(productId) && Boolean(dayId),
  })
}
