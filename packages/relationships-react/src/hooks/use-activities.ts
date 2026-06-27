"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type ActivitiesListFilters, relationshipsQueryKeys } from "../query-keys.js"
import { activityListResponse } from "../schemas.js"

export interface UseActivitiesOptions extends ActivitiesListFilters {
  enabled?: boolean
}

export function useActivities(options: UseActivitiesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.activitiesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.status) params.set("status", filters.status)
      if (filters.type) params.set("type", filters.type)
      if (filters.entityType) params.set("entityType", filters.entityType)
      if (filters.entityId) params.set("entityId", filters.entityId)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/relationships/activities${qs ? `?${qs}` : ""}`,
        activityListResponse,
        {
          baseUrl,
          fetcher,
        },
      )
    },
    enabled,
  })
}
