"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { ResourceAssignmentsListFilters } from "../query-keys.js"
import { getAssignmentsQueryOptions } from "../query-options.js"

export interface UseAssignmentsOptions extends ResourceAssignmentsListFilters {
  enabled?: boolean
}

export function useAssignments(options: UseAssignmentsOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getAssignmentsQueryOptions(client, options),
    enabled,
  })
}
