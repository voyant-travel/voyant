"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getOptionUnitTierQueryOptions } from "../query-options.js"

export interface UseOptionUnitTierOptions {
  enabled?: boolean
}

export function useOptionUnitTier(
  id: string | null | undefined,
  options: UseOptionUnitTierOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getOptionUnitTierQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
