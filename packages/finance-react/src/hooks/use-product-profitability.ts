"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceProductProfitabilityFilters } from "../query-keys.js"
import { getProductProfitabilityQueryOptions } from "../query-options.js"

export interface UseProductProfitabilityOptions extends FinanceProductProfitabilityFilters {
  enabled?: boolean
}

export function useProductProfitability(options: UseProductProfitabilityOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getProductProfitabilityQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
