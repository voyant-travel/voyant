"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import { getResourceQueryOptions } from "../query-options.js"

export interface UseResourceOptions {
  enabled?: boolean
}

export function useResource(id: string | null | undefined, options: UseResourceOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getResourceQueryOptions(client, id, options),
    enabled: enabled && Boolean(id),
  })
}
