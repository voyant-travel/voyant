"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type QuotesListFilters, quotesQueryKeys } from "../query-keys.js"
import { quoteListResponse } from "../schemas.js"

export interface UseQuotesOptions extends QuotesListFilters {
  enabled?: boolean
}

/**
 * Lists quotes with filters + pagination. Returns the raw
 * `{ data, total, limit, offset }` envelope.
 */
export function useQuotes(options: UseQuotesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: quotesQueryKeys.quotesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.personId) params.set("personId", filters.personId)
      if (filters.organizationId) params.set("organizationId", filters.organizationId)
      if (filters.pipelineId) params.set("pipelineId", filters.pipelineId)
      if (filters.stageId) params.set("stageId", filters.stageId)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.status) params.set("status", filters.status)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(`/v1/quotes/quotes${qs ? `?${qs}` : ""}`, quoteListResponse, {
        baseUrl,
        fetcher,
      })
    },
    enabled,
  })
}
