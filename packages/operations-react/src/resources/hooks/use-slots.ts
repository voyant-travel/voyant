"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { SlotsListFilters } from "../query-keys.js"
import { getSlotsQueryOptions } from "../query-options.js"

export interface UseSlotsOptions extends SlotsListFilters {
  enabled?: boolean
}

export function useSlots(options: UseSlotsOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getSlotsQueryOptions(client, options),
    enabled,
  })
}
