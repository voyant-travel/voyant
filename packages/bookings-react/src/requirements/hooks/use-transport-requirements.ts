"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingRequirementsContext } from "../provider.js"
import type { TransportRequirementsFilters } from "../query-keys.js"
import { getTransportRequirementsQueryOptions } from "../query-options.js"

export interface UseTransportRequirementsOptions extends TransportRequirementsFilters {
  enabled?: boolean
}

export function useTransportRequirements(options: UseTransportRequirementsOptions) {
  const client = useVoyantBookingRequirementsContext()
  const { enabled = true } = options
  return useQuery({ ...getTransportRequirementsQueryOptions(client, options), enabled })
}
