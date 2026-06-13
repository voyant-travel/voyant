"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import { getFacilityQueryOptions } from "../query-options.js"

export interface UseFacilityOptions {
  enabled?: boolean
}

export function useFacility(id: string | null | undefined, options: UseFacilityOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true } = options

  return useQuery({
    ...getFacilityQueryOptions({ baseUrl, fetcher }, id ?? ""),
    enabled: enabled && Boolean(id),
  })
}
