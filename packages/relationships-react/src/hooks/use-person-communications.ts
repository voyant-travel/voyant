"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type PersonCommunicationsListFilters, relationshipsQueryKeys } from "../query-keys.js"
import { personTimelinePageResponse } from "../schemas.js"

export interface UsePersonCommunicationsOptions extends PersonCommunicationsListFilters {
  enabled?: boolean
}

export function usePersonCommunications(
  personId: string | undefined,
  options: UsePersonCommunicationsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.personCommunications(personId ?? "", filters),
    queryFn: async () => {
      if (!personId) throw new Error("usePersonCommunications requires a personId")
      const params = new URLSearchParams()
      if (filters.channel) params.set("channel", filters.channel)
      if (filters.direction) params.set("direction", filters.direction)
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.set("dateTo", filters.dateTo)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.cursor !== undefined) params.set("cursor", filters.cursor)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/relationships/people/${personId}/communications/timeline${qs ? `?${qs}` : ""}`,
        personTimelinePageResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(personId),
  })
}
