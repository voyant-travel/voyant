"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import { quoteSingleResponse } from "../schemas.js"

export interface UseQuoteOptions {
  enabled?: boolean
}

export function useQuote(id: string | undefined, options: UseQuoteOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: crmQueryKeys.quote(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("useQuote requires an id")
      const { data } = await fetchWithValidation(`/v1/crm/quotes/${id}`, quoteSingleResponse, {
        baseUrl,
        fetcher,
      })
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
