"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingRequirementsContext } from "../provider.js"
import type { ContactRequirementsListFilters } from "../query-keys.js"
import { getContactRequirementsQueryOptions } from "../query-options.js"

export interface UseContactRequirementsOptions extends ContactRequirementsListFilters {
  enabled?: boolean
}

export function useContactRequirements(options: UseContactRequirementsOptions = {}) {
  const client = useVoyantBookingRequirementsContext()
  const { enabled = true } = options
  return useQuery({ ...getContactRequirementsQueryOptions(client, options), enabled })
}
