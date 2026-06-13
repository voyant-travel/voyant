"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { RulesListFilters } from "../query-keys.js"
import { getRulesQueryOptions } from "../query-options.js"

export interface UseRulesOptions extends RulesListFilters {
  enabled?: boolean
}

export function useRules(options: UseRulesOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getRulesQueryOptions(client, options),
    enabled,
  })
}
