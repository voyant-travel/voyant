"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { pricingCategoryDependencySingleResponse } from "../schemas.js"

export interface UsePricingCategoryDependencyOptions {
  enabled?: boolean
}

export function usePricingCategoryDependency(
  id: string | null | undefined,
  options: UsePricingCategoryDependencyOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: pricingQueryKeys.pricingCategoryDependency(id ?? "__missing__"),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/pricing-category-dependencies/${id}`,
        pricingCategoryDependencySingleResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
