"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import type { FacilityOperationSchedulesListFilters } from "../query-keys.js"
import { getFacilityOperationSchedulesQueryOptions } from "../query-options.js"

export interface UseFacilityOperationSchedulesOptions
  extends FacilityOperationSchedulesListFilters {
  enabled?: boolean
}

export function useFacilityOperationSchedules(options: UseFacilityOperationSchedulesOptions) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getFacilityOperationSchedulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled: enabled && Boolean(filters.facilityId),
  })
}
