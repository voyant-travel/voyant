"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import type { AvailabilityPickupPointsListFilters } from "../query-keys.js"
import { getPickupPointsQueryOptions } from "../query-options.js"

export interface UsePickupPointsOptions extends AvailabilityPickupPointsListFilters {
  enabled?: boolean
}

export function usePickupPoints(options: UsePickupPointsOptions = {}) {
  const client = useVoyantAvailabilityContext()
  const { enabled = true } = options
  return useQuery({ ...getPickupPointsQueryOptions(client, options), enabled })
}
