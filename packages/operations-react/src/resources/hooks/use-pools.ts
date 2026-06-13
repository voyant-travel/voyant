"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { ResourcePoolsListFilters } from "../query-keys.js"
import { getPoolsQueryOptions } from "../query-options.js"

export interface UsePoolsOptions extends ResourcePoolsListFilters {
  enabled?: boolean
}

export function usePools(options: UsePoolsOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getPoolsQueryOptions(client, options),
    enabled,
  })
}
