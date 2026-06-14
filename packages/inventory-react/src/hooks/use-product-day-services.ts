"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductDayServicesQueryOptions } from "../query-options.js"

export interface UseProductDayServicesOptions {
  enabled?: boolean
}

export function useProductDayServices(
  productId: string | null | undefined,
  dayId: string | null | undefined,
  options: UseProductDayServicesOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductDayServicesQueryOptions({ baseUrl, fetcher }, productId, dayId, options),
    enabled: enabled && Boolean(productId) && Boolean(dayId),
  })
}
