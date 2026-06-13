"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import type { AvailabilityOverviewFilters } from "../query-keys.js"
import { getAvailabilityOverviewQueryOptions } from "../query-options.js"

export interface UseAvailabilityOverviewOptions extends AvailabilityOverviewFilters {
  enabled?: boolean
}

export function useAvailabilityOverview(options: UseAvailabilityOverviewOptions = {}) {
  const client = useVoyantAvailabilityContext()
  const { enabled = true } = options
  return useQuery({ ...getAvailabilityOverviewQueryOptions(client, options), enabled })
}
