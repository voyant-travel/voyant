"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantMarketsContext } from "../provider.js"
import { getMarketQueryOptions } from "../query-options.js"

export interface UseMarketOptions {
  enabled?: boolean
}

export function useMarket(id: string | null | undefined, options: UseMarketOptions = {}) {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const { enabled = true } = options

  return useQuery({
    ...getMarketQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
