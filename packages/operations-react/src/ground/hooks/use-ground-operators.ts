"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantGroundContext } from "../provider.js"
import type { GroundOperatorsListFilters } from "../query-keys.js"
import { getGroundOperatorsQueryOptions } from "../query-options.js"

export interface UseGroundOperatorsOptions extends GroundOperatorsListFilters {
  enabled?: boolean
}

export function useGroundOperators(options: UseGroundOperatorsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantGroundContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getGroundOperatorsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
