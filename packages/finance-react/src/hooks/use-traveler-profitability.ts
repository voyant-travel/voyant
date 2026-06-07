"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceTravelerProfitabilityFilters } from "../query-keys.js"
import { getTravelerProfitabilityQueryOptions } from "../query-options.js"

export interface UseTravelerProfitabilityOptions extends FinanceTravelerProfitabilityFilters {
  enabled?: boolean
}

export function useTravelerProfitability({
  enabled = true,
  ...filters
}: UseTravelerProfitabilityOptions) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()

  return useQuery({
    ...getTravelerProfitabilityQueryOptions({ baseUrl, fetcher }, filters),
    enabled: enabled && Boolean(filters.departureId) && Boolean(filters.currency),
  })
}
