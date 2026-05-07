"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys, type PersonDocumentsListFilters } from "../query-keys.js"
import { personDocumentListResponse } from "../schemas.js"

export interface UsePersonDocumentsOptions extends PersonDocumentsListFilters {
  enabled?: boolean
}

/**
 * Lists identity documents for a person. The list includes encrypted
 * passport/ID numbers as KMS envelopes — consumers display structured
 * fields (type, expiry, country) and gate the decrypted number behind
 * a separate request.
 */
export function usePersonDocuments(
  personId: string | undefined,
  options: UsePersonDocumentsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: crmQueryKeys.personDocuments(personId ?? "", filters),
    queryFn: async () => {
      if (!personId) throw new Error("usePersonDocuments requires a personId")
      const params = new URLSearchParams()
      if (filters.type) params.set("type", filters.type)
      if (filters.expiringBefore) params.set("expiringBefore", filters.expiringBefore)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/crm/people/${personId}/documents${qs ? `?${qs}` : ""}`,
        personDocumentListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(personId),
  })
}
