"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getPricingCategoryQueryOptions } from "../query-options.js"

export interface UsePricingCategoryOptions {
  enabled?: boolean
}

export function usePricingCategory(
  id: string | null | undefined,
  options: UsePricingCategoryOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getPricingCategoryQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
