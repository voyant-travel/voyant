"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import { getAssignmentQueryOptions } from "../query-options.js"

export interface UseAssignmentOptions {
  enabled?: boolean
}

export function useAssignment(id: string | null | undefined, options: UseAssignmentOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getAssignmentQueryOptions(client, id, options),
    enabled: enabled && Boolean(id),
  })
}
