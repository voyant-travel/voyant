"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductVersionsQueryOptions } from "../query-options.js"

export interface UseProductVersionsOptions {
  enabled?: boolean
}

export function useProductVersions(
  productId: string | null | undefined,
  options: UseProductVersionsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductVersionsQueryOptions({ baseUrl, fetcher }, productId, options),
    enabled: enabled && Boolean(productId),
  })
}
