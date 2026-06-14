"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { OptionUnitTiersListFilters } from "../query-keys.js"
import { getOptionUnitTiersQueryOptions } from "../query-options.js"

export interface UseOptionUnitTiersOptions extends OptionUnitTiersListFilters {
  enabled?: boolean
}

export function useOptionUnitTiers(options: UseOptionUnitTiersOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getOptionUnitTiersQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
