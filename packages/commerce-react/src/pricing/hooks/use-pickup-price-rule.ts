"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getPickupPriceRuleQueryOptions } from "../query-options.js"

export interface UsePickupPriceRuleOptions {
  enabled?: boolean
}

export function usePickupPriceRule(
  id: string | null | undefined,
  options: UsePickupPriceRuleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getPickupPriceRuleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
