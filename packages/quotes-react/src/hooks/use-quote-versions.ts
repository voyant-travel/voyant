"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type QuoteVersionsListFilters, quotesQueryKeys } from "../query-keys.js"
import { quoteVersionListResponse } from "../schemas.js"

export interface UseQuoteVersionsOptions extends QuoteVersionsListFilters {
  enabled?: boolean
}

export function useQuoteVersions(options: UseQuoteVersionsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: quotesQueryKeys.quoteVersionsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.quoteId) params.set("quoteId", filters.quoteId)
      if (filters.status) params.set("status", filters.status)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/quotes/quote-versions${qs ? `?${qs}` : ""}`,
        quoteVersionListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}
