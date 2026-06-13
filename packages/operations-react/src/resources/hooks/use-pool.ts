"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import { getPoolQueryOptions } from "../query-options.js"

export interface UsePoolOptions {
  enabled?: boolean
}

export function usePool(id: string | null | undefined, options: UsePoolOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getPoolQueryOptions(client, id, options),
    enabled: enabled && Boolean(id),
  })
}
