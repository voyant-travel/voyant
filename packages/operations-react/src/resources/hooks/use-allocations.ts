"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { ResourceAllocationsListFilters } from "../query-keys.js"
import { getAllocationsQueryOptions } from "../query-options.js"

export interface UseAllocationsOptions extends ResourceAllocationsListFilters {
  enabled?: boolean
}

export function useAllocations(options: UseAllocationsOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getAllocationsQueryOptions(client, options),
    enabled,
  })
}
