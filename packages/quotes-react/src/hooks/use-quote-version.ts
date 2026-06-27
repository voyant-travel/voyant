"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteVersionLineListResponse, quoteVersionSingleResponse } from "../schemas.js"

export interface UseQuoteVersionOptions {
  enabled?: boolean
}

export function useQuoteVersion(id: string | undefined, options: UseQuoteVersionOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: quotesQueryKeys.quoteVersion(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("useQuoteVersion requires an id")
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}

export function useQuoteVersionLines(
  quoteVersionId: string | undefined,
  options: UseQuoteVersionOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: quotesQueryKeys.quoteVersionLines(quoteVersionId ?? ""),
    queryFn: async () => {
      if (!quoteVersionId) throw new Error("useQuoteVersionLines requires a quoteVersionId")
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${quoteVersionId}/lines`,
        quoteVersionLineListResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(quoteVersionId),
  })
}
