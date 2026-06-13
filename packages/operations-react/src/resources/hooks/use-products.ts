"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { PaginationFilters } from "../query-keys.js"
import { getProductsQueryOptions } from "../query-options.js"

export interface UseProductsOptions extends PaginationFilters {
  enabled?: boolean
}

export function useProducts(options: UseProductsOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductsQueryOptions(client, options),
    enabled,
  })
}
