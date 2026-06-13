"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFacilitiesContext } from "../provider.js"
import { getPropertyQueryOptions } from "../query-options.js"

export interface UsePropertyOptions {
  enabled?: boolean
}

export function useProperty(id: string | null | undefined, options: UsePropertyOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const { enabled = true } = options

  return useQuery({
    ...getPropertyQueryOptions({ baseUrl, fetcher }, id ?? ""),
    enabled: enabled && Boolean(id),
  })
}
