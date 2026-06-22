"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteProductListResponse } from "../schemas.js"

export interface UseQuoteProductsOptions {
  enabled?: boolean
}

/** Lists a quote's products — the line items (flights, stays, experiences, …). */
export function useQuoteProducts(
  quoteId: string | undefined,
  options: UseQuoteProductsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: quotesQueryKeys.quoteProducts(quoteId ?? ""),
    queryFn: () =>
      fetchWithValidation(`/v1/quotes/quotes/${quoteId}/products`, quoteProductListResponse, {
        baseUrl,
        fetcher,
      }),
    enabled: enabled && Boolean(quoteId),
  })
}
