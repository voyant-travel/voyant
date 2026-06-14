"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type PersonRelationshipsListFilters, relationshipsQueryKeys } from "../query-keys.js"
import { personRelationshipListResponse } from "../schemas.js"

export interface UsePersonRelationshipsOptions extends PersonRelationshipsListFilters {
  enabled?: boolean
}

/**
 * Lists relationships for a person. Default direction `both` returns
 * the union of incoming and outgoing edges — the typical "Jane's
 * family" UI shape.
 */
export function usePersonRelationships(
  personId: string | undefined,
  options: UsePersonRelationshipsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.personRelationships(personId ?? "", filters),
    queryFn: async () => {
      if (!personId) throw new Error("usePersonRelationships requires a personId")
      const params = new URLSearchParams()
      if (filters.kind) params.set("kind", filters.kind)
      if (filters.direction) params.set("direction", filters.direction)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/relationships/people/${personId}/relationships${qs ? `?${qs}` : ""}`,
        personRelationshipListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(personId),
  })
}
