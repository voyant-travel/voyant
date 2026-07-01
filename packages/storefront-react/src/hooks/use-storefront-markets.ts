"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantStorefrontContext } from "../provider.js"
import { getStorefrontMarketsQueryOptions } from "../query-options.js"

export interface UseStorefrontMarketsOptions {
  enabled?: boolean
}

/**
 * Fetches the anonymous market discovery list (`GET /v1/public/markets`,
 * voyant#2643). Each market carries its supported locales and currencies so a
 * storefront can render a market/currency/locale scope selector. The market
 * `id` is the catalog-search scope key.
 */
export function useStorefrontMarkets(options: UseStorefrontMarketsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantStorefrontContext()
  const { enabled = true } = options

  return useQuery({
    ...getStorefrontMarketsQueryOptions({ baseUrl, fetcher }),
    enabled,
  })
}
