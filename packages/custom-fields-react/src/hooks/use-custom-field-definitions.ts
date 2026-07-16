"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantContext } from "../provider.js"
import type { CustomFieldDefinitionListFilters } from "../query-keys.js"
import { getCustomFieldDefinitionsQueryOptions } from "../query-options.js"

export interface UseCustomFieldDefinitionsOptions extends CustomFieldDefinitionListFilters {
  enabled?: boolean
}

export function useCustomFieldDefinitions(options: UseCustomFieldDefinitionsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getCustomFieldDefinitionsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
