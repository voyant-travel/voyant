"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductOptionQueryOptions } from "../query-options.js"

export interface UseProductOptionOptions {
  enabled?: boolean
}

export function useProductOption(
  id: string | null | undefined,
  options: UseProductOptionOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductOptionQueryOptions({ baseUrl, fetcher }, id, options),
    enabled: enabled && Boolean(id),
  })
}
