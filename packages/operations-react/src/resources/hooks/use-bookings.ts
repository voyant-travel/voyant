"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { PaginationFilters } from "../query-keys.js"
import { getBookingsQueryOptions } from "../query-options.js"

export interface UseBookingsOptions extends PaginationFilters {
  enabled?: boolean
}

export function useBookings(options: UseBookingsOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getBookingsQueryOptions(client, options),
    enabled,
  })
}
