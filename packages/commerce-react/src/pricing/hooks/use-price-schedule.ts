"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getPriceScheduleQueryOptions } from "../query-options.js"

export interface UsePriceScheduleOptions {
  enabled?: boolean
}

export function usePriceSchedule(
  id: string | null | undefined,
  options: UsePriceScheduleOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getPriceScheduleQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
