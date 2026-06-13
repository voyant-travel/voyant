"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getExtraPriceRuleQueryOptions } from "../query-options.js"

export interface UseExtraPriceRuleOptions {
  enabled?: boolean
}

export function useExtraPriceRule(
  id: string | null | undefined,
  options: UseExtraPriceRuleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getExtraPriceRuleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
