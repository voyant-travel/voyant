"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSellabilityContext } from "../provider.js"
import { getSellabilityPolicyQueryOptions } from "../query-options.js"

export interface UseSellabilityPolicyOptions {
  enabled?: boolean
}

export function useSellabilityPolicy(
  id: string | null | undefined,
  options: UseSellabilityPolicyOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantSellabilityContext()
  const { enabled = true } = options

  return useQuery({
    ...getSellabilityPolicyQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
