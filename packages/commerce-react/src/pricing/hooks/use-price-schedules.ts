"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getPriceSchedulesQueryOptions } from "../query-options.js"

export interface UsePriceSchedulesOptions {
  priceCatalogId?: string | undefined
  active?: boolean | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
  enabled?: boolean | undefined
}

export function usePriceSchedules(options: UsePriceSchedulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()

  return useQuery({
    ...getPriceSchedulesQueryOptions({ baseUrl, fetcher }, options),
    enabled: Boolean(options.enabled ?? true),
  })
}
