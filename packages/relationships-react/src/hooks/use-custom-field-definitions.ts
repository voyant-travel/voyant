"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type CustomFieldDefinitionListFilters, relationshipsQueryKeys } from "../query-keys.js"
import { customFieldDefinitionListResponse } from "../schemas.js"

export interface UseCustomFieldDefinitionsOptions extends CustomFieldDefinitionListFilters {
  enabled?: boolean
}

export function useCustomFieldDefinitions(options: UseCustomFieldDefinitionsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.customFieldDefinitionsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.entityType) params.set("entityType", filters.entityType)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/admin/relationships/custom-fields${qs ? `?${qs}` : ""}`,
        customFieldDefinitionListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}
