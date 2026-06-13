"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import type { AvailabilitySlotsListFilters } from "../query-keys.js"
import { getSlotsQueryOptions } from "../query-options.js"

export interface UseSlotsOptions extends AvailabilitySlotsListFilters {
  enabled?: boolean
}

export function useSlots(options: UseSlotsOptions = {}) {
  const client = useVoyantAvailabilityContext()
  const { enabled = true } = options
  return useQuery({ ...getSlotsQueryOptions(client, options), enabled })
}
