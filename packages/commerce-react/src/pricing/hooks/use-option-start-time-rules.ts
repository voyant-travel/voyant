"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { OptionStartTimeRulesListFilters } from "../query-keys.js"
import { getOptionStartTimeRulesQueryOptions } from "../query-options.js"

export interface UseOptionStartTimeRulesOptions extends OptionStartTimeRulesListFilters {
  enabled?: boolean
}

export function useOptionStartTimeRules(options: UseOptionStartTimeRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getOptionStartTimeRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
