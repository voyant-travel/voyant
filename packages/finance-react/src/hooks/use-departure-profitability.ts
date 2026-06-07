"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceDepartureProfitabilityFilters } from "../query-keys.js"
import { getDepartureProfitabilityQueryOptions } from "../query-options.js"

export interface UseDepartureProfitabilityOptions extends FinanceDepartureProfitabilityFilters {
  enabled?: boolean
}

export function useDepartureProfitability(options: UseDepartureProfitabilityOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getDepartureProfitabilityQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
