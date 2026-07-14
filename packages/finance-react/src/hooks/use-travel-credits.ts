"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceTravelCreditListFilters } from "../query-keys.js"
import { getTravelCreditsQueryOptions } from "../query-options.js"

export interface UseTravelCreditsOptions extends FinanceTravelCreditListFilters {
  enabled?: boolean
}

/**
 * Admin Travel Credit list. Filters by status, person/org assignment, free-text
 * search over code/notes, and `hasBalance` (remaining > 0). Use
 * `hasBalance: true` for the Travel Credit picker in booking-create flows. A
 * Travel Credit with zero balance is a historical record, not spendable credit.
 */
export function useTravelCredits(options: UseTravelCreditsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getTravelCreditsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
