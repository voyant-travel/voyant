"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { StartTimesListFilters } from "../query-keys.js"
import { getStartTimesQueryOptions } from "../query-options.js"

export interface UseStartTimesOptions extends StartTimesListFilters {
  enabled?: boolean
}

export function useStartTimes(options: UseStartTimesOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getStartTimesQueryOptions(client, options),
    enabled,
  })
}
