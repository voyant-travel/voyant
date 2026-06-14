"use client"

import { useQuery } from "@tanstack/react-query"
import { useVoyantProductsContext } from "../provider.js"
import { getOptionUnitQueryOptions } from "../query-options.js"

export interface UseOptionUnitOptions {
  enabled?: boolean
}

export function useOptionUnit(id: string | undefined, options: UseOptionUnitOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getOptionUnitQueryOptions({ baseUrl, fetcher }, id, options),
    enabled: enabled && !!id,
  })
}
