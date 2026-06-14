"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { type PricingCategoryDependenciesListFilters, pricingQueryKeys } from "../query-keys.js"
import { pricingCategoryDependencyListResponse } from "../schemas.js"

export interface UsePricingCategoryDependenciesOptions
  extends PricingCategoryDependenciesListFilters {
  enabled?: boolean
}

export function usePricingCategoryDependencies(
  options: UsePricingCategoryDependenciesOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: pricingQueryKeys.pricingCategoryDependenciesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.pricingCategoryId) params.set("pricingCategoryId", filters.pricingCategoryId)
      if (filters.masterPricingCategoryId) {
        params.set("masterPricingCategoryId", filters.masterPricingCategoryId)
      }
      if (filters.dependencyType) params.set("dependencyType", filters.dependencyType)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/pricing/pricing-category-dependencies${qs ? `?${qs}` : ""}`,
        pricingCategoryDependencyListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}
