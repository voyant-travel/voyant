"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type PeopleListFilters, relationshipsQueryKeys } from "../query-keys.js"
import { personListResponse } from "../schemas.js"

export interface UsePeopleOptions extends PeopleListFilters {
  enabled?: boolean
}

/**
 * Lists people from the CRM with pagination + search + filters. Returns the
 * raw `{ data, total, limit, offset }` envelope so consumers can build
 * paginated tables directly from the response.
 */
export function usePeople(options: UsePeopleOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.peopleList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.organizationId) params.set("organizationId", filters.organizationId)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.relation) params.set("relation", filters.relation)
      if (filters.status) params.set("status", filters.status)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/relationships/people${qs ? `?${qs}` : ""}`,
        personListResponse,
        {
          baseUrl,
          fetcher,
        },
      )
    },
    enabled,
  })
}
