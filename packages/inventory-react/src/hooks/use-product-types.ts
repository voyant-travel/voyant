"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import type { ProductTypesListFilters } from "../query-keys.js"
import { getProductTypesQueryOptions } from "../query-options.js"

export interface UseProductTypesOptions extends ProductTypesListFilters {
  enabled?: boolean
}

export function useProductTypes(options: UseProductTypesOptions = {}) {
  const client = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({ ...getProductTypesQueryOptions(client, options), enabled })
}
