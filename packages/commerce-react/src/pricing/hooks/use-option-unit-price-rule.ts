"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getOptionUnitPriceRuleQueryOptions } from "../query-options.js"

export interface UseOptionUnitPriceRuleOptions {
  enabled?: boolean
}

export function useOptionUnitPriceRule(
  id: string | null | undefined,
  options: UseOptionUnitPriceRuleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getOptionUnitPriceRuleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
