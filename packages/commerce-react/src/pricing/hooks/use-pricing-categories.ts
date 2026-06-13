"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { type PricingCategoriesListFilters, pricingQueryKeys } from "../query-keys.js"
import { pricingCategoryListResponse } from "../schemas.js"

export interface UsePricingCategoriesOptions extends PricingCategoriesListFilters {
  enabled?: boolean
}

export function usePricingCategories(options: UsePricingCategoriesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: pricingQueryKeys.pricingCategoriesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.unitId) params.set("unitId", filters.unitId)
      if (filters.categoryType) params.set("categoryType", filters.categoryType)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/pricing/pricing-categories${qs ? `?${qs}` : ""}`,
        pricingCategoryListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}
