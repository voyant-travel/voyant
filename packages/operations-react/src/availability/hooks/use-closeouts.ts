"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import type { AvailabilityCloseoutsListFilters } from "../query-keys.js"
import { getCloseoutsQueryOptions } from "../query-options.js"

export interface UseCloseoutsOptions extends AvailabilityCloseoutsListFilters {
  enabled?: boolean
}

export function useCloseouts(options: UseCloseoutsOptions = {}) {
  const client = useVoyantAvailabilityContext()
  const { enabled = true } = options
  return useQuery({ ...getCloseoutsQueryOptions(client, options), enabled })
}
