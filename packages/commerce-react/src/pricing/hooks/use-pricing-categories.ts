"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { PricingCategoriesListFilters } from "../query-keys.js"
import { getPricingCategoriesQueryOptions } from "../query-options.js"

export interface UsePricingCategoriesOptions extends PricingCategoriesListFilters {
  enabled?: boolean
}

export function usePricingCategories(options: UsePricingCategoriesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getPricingCategoriesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
