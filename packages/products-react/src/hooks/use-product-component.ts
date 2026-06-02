"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductComponentQueryOptions } from "../query-options.js"

export interface UseProductComponentOptions {
  enabled?: boolean
}

export function useProductComponent(
  id: string | null | undefined,
  options: UseProductComponentOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductComponentQueryOptions({ baseUrl, fetcher }, id, options),
    enabled: enabled && !!id,
  })
}
