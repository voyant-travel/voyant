"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type CustomerSignalsListFilters, crmQueryKeys } from "../query-keys.js"
import { customerSignalListByPersonResponse, customerSignalListResponse } from "../schemas.js"

export interface UseCustomerSignalsOptions extends CustomerSignalsListFilters {
  enabled?: boolean
}

/** Top-level paginated list with optional filters. */
export function useCustomerSignals(options: UseCustomerSignalsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: crmQueryKeys.customerSignalsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.personId) params.set("personId", filters.personId)
      if (filters.assignedToUserId) params.set("assignedToUserId", filters.assignedToUserId)
      if (filters.status) params.set("status", filters.status)
      if (filters.kind) params.set("kind", filters.kind)
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/crm/customer-signals${qs ? `?${qs}` : ""}`,
        customerSignalListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}

export interface UseCustomerSignalsForPersonOptions {
  enabled?: boolean
}

/** Convenience: chronological list of signals for a single person. */
export function useCustomerSignalsForPerson(
  personId: string | undefined,
  options: UseCustomerSignalsForPersonOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: crmQueryKeys.customerSignalsByPerson(personId ?? ""),
    queryFn: async () => {
      if (!personId) throw new Error("useCustomerSignalsForPerson requires a personId")
      return fetchWithValidation(
        `/v1/crm/people/${personId}/signals`,
        customerSignalListByPersonResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(personId),
  })
}
