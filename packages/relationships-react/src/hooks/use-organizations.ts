"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type OrganizationsListFilters, relationshipsQueryKeys } from "../query-keys.js"
import { organizationListResponse } from "../schemas.js"

export interface UseOrganizationsOptions extends OrganizationsListFilters {
  enabled?: boolean
}

export function useOrganizations(options: UseOrganizationsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.organizationsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.taxId) params.set("taxId", filters.taxId)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.relation) params.set("relation", filters.relation)
      if (filters.status) params.set("status", filters.status)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/relationships/organizations${qs ? `?${qs}` : ""}`,
        organizationListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}
