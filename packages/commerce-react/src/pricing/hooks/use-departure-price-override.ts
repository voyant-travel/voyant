"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getDeparturePriceOverrideQueryOptions } from "../query-options.js"

export function useDeparturePriceOverride(
  id: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getDeparturePriceOverrideQueryOptions({ baseUrl, fetcher }, id ?? ""),
    enabled: enabled && !!id,
  })
}
