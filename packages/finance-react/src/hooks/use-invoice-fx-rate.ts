"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceInvoiceFxRateFilters } from "../query-keys.js"
import { getInvoiceFxRateQueryOptions } from "../query-options.js"

export interface UseInvoiceFxRateOptions extends FinanceInvoiceFxRateFilters {
  enabled?: boolean
}

export function useInvoiceFxRate(options: UseInvoiceFxRateOptions) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getInvoiceFxRateQueryOptions({ baseUrl, fetcher }, filters),
    enabled: enabled && Boolean(filters.baseCurrency && filters.quoteCurrency),
    retry: false,
  })
}
