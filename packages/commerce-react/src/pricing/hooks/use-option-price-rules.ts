"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { OptionPriceRulesListFilters } from "../query-keys.js"
import { getOptionPriceRulesQueryOptions } from "../query-options.js"

export interface UseOptionPriceRulesOptions extends OptionPriceRulesListFilters {
  enabled?: boolean
}

export function useOptionPriceRules(options: UseOptionPriceRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getOptionPriceRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
