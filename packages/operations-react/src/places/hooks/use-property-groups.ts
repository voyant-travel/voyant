"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import type { PropertyGroupsListFilters } from "../query-keys.js"
import { getPropertyGroupsQueryOptions } from "../query-options.js"

export interface UsePropertyGroupsOptions extends PropertyGroupsListFilters {
  enabled?: boolean
}

export function usePropertyGroups(options: UsePropertyGroupsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getPropertyGroupsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
