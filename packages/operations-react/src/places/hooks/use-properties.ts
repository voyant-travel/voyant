"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import type { PropertiesListFilters } from "../query-keys.js"
import { getPropertiesQueryOptions } from "../query-options.js"

export interface UsePropertiesOptions extends PropertiesListFilters {
  enabled?: boolean
}

export function useProperties(options: UsePropertiesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getPropertiesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
