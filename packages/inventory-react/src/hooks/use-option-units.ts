"use client"

import { useQuery } from "@tanstack/react-query"
import { useVoyantProductsContext } from "../provider.js"
import type { OptionUnitsListFilters } from "../query-keys.js"
import { getOptionUnitsQueryOptions } from "../query-options.js"

export interface UseOptionUnitsOptions extends OptionUnitsListFilters {
  enabled?: boolean
}

export function useOptionUnits(options: UseOptionUnitsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getOptionUnitsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
