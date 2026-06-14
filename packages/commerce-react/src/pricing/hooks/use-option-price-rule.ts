"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getOptionPriceRuleQueryOptions } from "../query-options.js"

export interface UseOptionPriceRuleOptions {
  enabled?: boolean
}

export function useOptionPriceRule(
  id: string | null | undefined,
  options: UseOptionPriceRuleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getOptionPriceRuleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
