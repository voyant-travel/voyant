"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import type { FacilitiesListFilters } from "../query-keys.js"
import { getFacilitiesQueryOptions } from "../query-options.js"

export interface UseFacilitiesOptions extends FacilitiesListFilters {
  enabled?: boolean
}

export function useFacilities(options: UseFacilitiesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getFacilitiesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
