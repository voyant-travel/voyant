"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type PersonCommunicationsListFilters, relationshipsQueryKeys } from "../query-keys.js"
import { communicationLogListResponse } from "../schemas.js"

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
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/relationships/people/${personId}/communications${qs ? `?${qs}` : ""}`,
        communicationLogListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(personId),
  })
}
