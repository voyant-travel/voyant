"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { ResourceCloseoutsListFilters } from "../query-keys.js"
import { getCloseoutsQueryOptions } from "../query-options.js"

export interface UseCloseoutsOptions extends ResourceCloseoutsListFilters {
  enabled?: boolean
}

export function useCloseouts(options: UseCloseoutsOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getCloseoutsQueryOptions(client, options),
    enabled,
  })
}
