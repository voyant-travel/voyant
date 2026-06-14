"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { ResourcesListFilters } from "../query-keys.js"
import { getResourcesQueryOptions } from "../query-options.js"

export interface UseResourcesOptions extends ResourcesListFilters {
  enabled?: boolean
}

export function useResources(options: UseResourcesOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getResourcesQueryOptions(client, options),
    enabled,
  })
}
