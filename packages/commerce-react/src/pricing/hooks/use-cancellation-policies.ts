"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { CancellationPoliciesListFilters } from "../query-keys.js"
import { getCancellationPoliciesQueryOptions } from "../query-options.js"

export interface UseCancellationPoliciesOptions extends CancellationPoliciesListFilters {
  enabled?: boolean
}

export function useCancellationPolicies(options: UseCancellationPoliciesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getCancellationPoliciesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
