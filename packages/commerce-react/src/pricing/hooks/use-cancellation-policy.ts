"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getCancellationPolicyQueryOptions } from "../query-options.js"

export interface UseCancellationPolicyOptions {
  enabled?: boolean
}

export function useCancellationPolicy(
  id: string | null | undefined,
  options: UseCancellationPolicyOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getCancellationPolicyQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
