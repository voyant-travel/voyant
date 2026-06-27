"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { dayServiceTranslationListResponse } from "../schemas.js"

export interface UseDayServiceTranslationsOptions {
  enabled?: boolean | undefined
}

export function useDayServiceTranslations(
  productId: string | null | undefined,
  dayId: string | null | undefined,
  serviceId: string | null | undefined,
  options: UseDayServiceTranslationsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: productsQueryKeys.dayServiceTranslations(
      productId ?? "",
      dayId ?? "",
      serviceId ?? "",
    ),
    queryFn: () => {
      if (!productId || !dayId || !serviceId) {
        throw new Error("useDayServiceTranslations requires a productId, dayId, and serviceId")
      }

      return fetchWithValidation(
        `/v1/admin/products/${productId}/days/${dayId}/services/${serviceId}/translations`,
        dayServiceTranslationListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(productId) && Boolean(dayId) && Boolean(serviceId),
  })
}
