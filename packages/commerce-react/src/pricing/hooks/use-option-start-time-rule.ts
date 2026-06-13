"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getOptionStartTimeRuleQueryOptions } from "../query-options.js"

export interface UseOptionStartTimeRuleOptions {
  enabled?: boolean
}

export function useOptionStartTimeRule(
  id: string | null | undefined,
  options: UseOptionStartTimeRuleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getOptionStartTimeRuleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
