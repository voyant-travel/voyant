"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getCancellationPolicyRuleQueryOptions } from "../query-options.js"

export interface UseCancellationPolicyRuleOptions {
  enabled?: boolean
}

export function useCancellationPolicyRule(
  id: string | null | undefined,
  options: UseCancellationPolicyRuleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getCancellationPolicyRuleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
