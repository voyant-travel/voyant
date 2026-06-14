"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import { getPropertyGroupQueryOptions } from "../query-options.js"

export interface UsePropertyGroupOptions {
  enabled?: boolean
}

export function usePropertyGroup(
  id: string | null | undefined,
  options: UsePropertyGroupOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true } = options

  return useQuery({
    ...getPropertyGroupQueryOptions({ baseUrl, fetcher }, id ?? ""),
    enabled: enabled && Boolean(id),
  })
}
