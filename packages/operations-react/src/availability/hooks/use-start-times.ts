"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import type { AvailabilityStartTimesListFilters } from "../query-keys.js"
import { getStartTimesQueryOptions } from "../query-options.js"

export interface UseStartTimesOptions extends AvailabilityStartTimesListFilters {
  enabled?: boolean
}

export function useStartTimes(options: UseStartTimesOptions = {}) {
  const client = useVoyantAvailabilityContext()
  const { enabled = true } = options
  return useQuery({ ...getStartTimesQueryOptions(client, options), enabled })
}
