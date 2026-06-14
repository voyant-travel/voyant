"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantGroundContext } from "../provider.js"
import type { GroundDriversListFilters } from "../query-keys.js"
import { getGroundDriversQueryOptions } from "../query-options.js"

export interface UseGroundDriversOptions extends GroundDriversListFilters {
  enabled?: boolean
}

export function useGroundDrivers(options: UseGroundDriversOptions = {}) {
  const { baseUrl, fetcher } = useVoyantGroundContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getGroundDriversQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
