"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { CancellationPolicyRulesListFilters } from "../query-keys.js"
import { getCancellationPolicyRulesQueryOptions } from "../query-options.js"

export interface UseCancellationPolicyRulesOptions extends CancellationPolicyRulesListFilters {
  enabled?: boolean
}

export function useCancellationPolicyRules(options: UseCancellationPolicyRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getCancellationPolicyRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
