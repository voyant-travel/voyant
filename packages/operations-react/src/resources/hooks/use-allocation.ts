"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import { getAllocationQueryOptions } from "../query-options.js"

export interface UseAllocationOptions {
  enabled?: boolean
}

export function useAllocation(id: string | null | undefined, options: UseAllocationOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getAllocationQueryOptions(client, id, options),
    enabled: enabled && Boolean(id),
  })
}
