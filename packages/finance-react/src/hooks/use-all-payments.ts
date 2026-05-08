"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceAllPaymentsListFilters } from "../query-keys.js"
import { getAllPaymentsQueryOptions } from "../query-options.js"

export interface UseAllPaymentsOptions extends FinanceAllPaymentsListFilters {
  enabled?: boolean
}

export function useAllPayments(options: UseAllPaymentsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getAllPaymentsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
