"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteMediaListResponse } from "../schemas.js"

export interface UseQuoteMediaOptions {
  enabled?: boolean
}

/** Lists a quote's media (images / videos / documents shown on the proposal). */
export function useQuoteMedia(quoteId: string | undefined, options: UseQuoteMediaOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: quotesQueryKeys.quoteMedia(quoteId ?? ""),
    queryFn: () =>
      fetchWithValidation(`/v1/quotes/quotes/${quoteId}/media`, quoteMediaListResponse, {
        baseUrl,
        fetcher,
      }),
    enabled: enabled && Boolean(quoteId),
  })
}
