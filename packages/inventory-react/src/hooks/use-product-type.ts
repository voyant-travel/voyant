"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductTypeQueryOptions } from "../query-options.js"

export interface UseProductTypeOptions {
  enabled?: boolean
}

export function useProductType(id: string | null | undefined, options: UseProductTypeOptions = {}) {
  const client = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductTypeQueryOptions(client, id),
    enabled: enabled && Boolean(id),
  })
}
