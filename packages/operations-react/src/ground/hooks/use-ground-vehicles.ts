"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantGroundContext } from "../provider.js"
import type { GroundVehiclesListFilters } from "../query-keys.js"
import { getGroundVehiclesQueryOptions } from "../query-options.js"

export interface UseGroundVehiclesOptions extends GroundVehiclesListFilters {
  enabled?: boolean
}

export function useGroundVehicles(options: UseGroundVehiclesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantGroundContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getGroundVehiclesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
