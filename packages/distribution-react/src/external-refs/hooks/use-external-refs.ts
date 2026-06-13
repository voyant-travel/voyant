"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantExternalRefsContext } from "../provider.js"
import type { ExternalRefsListFilters } from "../query-keys.js"
import { getExternalRefsQueryOptions } from "../query-options.js"

export interface UseExternalRefsOptions extends ExternalRefsListFilters {
  enabled?: boolean
}

export function useExternalRefs(options: UseExternalRefsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantExternalRefsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getExternalRefsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
