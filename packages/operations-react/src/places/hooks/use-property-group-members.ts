"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import type { PropertyGroupMembersListFilters } from "../query-keys.js"
import { getPropertyGroupMembersQueryOptions } from "../query-options.js"

export interface UsePropertyGroupMembersOptions extends PropertyGroupMembersListFilters {
  enabled?: boolean
}

export function usePropertyGroupMembers(options: UsePropertyGroupMembersOptions) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getPropertyGroupMembersQueryOptions({ baseUrl, fetcher }, filters),
    enabled: enabled && Boolean(filters.groupId),
  })
}
