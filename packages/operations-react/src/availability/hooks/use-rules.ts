"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAvailabilityContext } from "../provider.js"
import type { AvailabilityRulesListFilters } from "../query-keys.js"
import { getRulesQueryOptions } from "../query-options.js"

export interface UseRulesOptions extends AvailabilityRulesListFilters {
  enabled?: boolean
}

export function useRules(options: UseRulesOptions = {}) {
  const client = useVoyantAvailabilityContext()
  const { enabled = true } = options
  return useQuery({ ...getRulesQueryOptions(client, options), enabled })
}
