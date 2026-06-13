"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { DropoffPriceRulesListFilters } from "../query-keys.js"
import { getDropoffPriceRulesQueryOptions } from "../query-options.js"

export interface UseDropoffPriceRulesOptions extends DropoffPriceRulesListFilters {
  enabled?: boolean
}

export function useDropoffPriceRules(options: UseDropoffPriceRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getDropoffPriceRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
