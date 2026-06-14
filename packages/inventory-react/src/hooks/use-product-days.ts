"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductDaysQueryOptions } from "../query-options.js"

export interface UseProductDaysOptions {
  enabled?: boolean
}

export function useProductDays(
  productId: string | null | undefined,
  options: UseProductDaysOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductDaysQueryOptions({ baseUrl, fetcher }, productId, options),
    enabled: enabled && Boolean(productId),
  })
}
