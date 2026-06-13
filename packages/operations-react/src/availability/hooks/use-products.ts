"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import type { ProductListFilters } from "../query-keys.js"
import { getProductsQueryOptions } from "../query-options.js"

export interface UseProductsOptions extends ProductListFilters {
  enabled?: boolean
}

export function useProducts(options: UseProductsOptions = {}) {
  const client = useVoyantAvailabilityContext()
  const { enabled = true } = options
  return useQuery({ ...getProductsQueryOptions(client, options), enabled })
}
