"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getDropoffPriceRuleQueryOptions } from "../query-options.js"

export interface UseDropoffPriceRuleOptions {
  enabled?: boolean
}

export function useDropoffPriceRule(
  id: string | null | undefined,
  options: UseDropoffPriceRuleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getDropoffPriceRuleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
