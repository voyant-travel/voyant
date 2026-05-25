"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceInvoiceNumberSeriesListFilters } from "../query-keys.js"
import { getInvoiceNumberSeriesQueryOptions } from "../query-options.js"

export interface UseInvoiceNumberSeriesOptions extends FinanceInvoiceNumberSeriesListFilters {
  enabled?: boolean
}

export function useInvoiceNumberSeries(options: UseInvoiceNumberSeriesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getInvoiceNumberSeriesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
