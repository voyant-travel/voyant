"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import type { FacilityFeaturesListFilters } from "../query-keys.js"
import { getFacilityFeaturesQueryOptions } from "../query-options.js"

export interface UseFacilityFeaturesOptions extends FacilityFeaturesListFilters {
  enabled?: boolean
}

export function useFacilityFeatures(options: UseFacilityFeaturesOptions) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getFacilityFeaturesQueryOptions({ baseUrl, fetcher }, filters),
    enabled: enabled && Boolean(filters.facilityId),
  })
}
