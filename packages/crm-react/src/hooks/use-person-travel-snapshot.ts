"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import { personTravelSnapshotResponse } from "../schemas.js"

export interface UsePersonTravelSnapshotOptions {
  enabled?: boolean
}

/**
 * Decrypted snapshot of a person's primary passport + dietary +
 * accessibility values. Used by the operator booking-traveler dialog
 * to pre-fill snapshot fields when an operator picks an existing
 * person.
 */
export function usePersonTravelSnapshot(
  personId: string | undefined,
  options: UsePersonTravelSnapshotOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: crmQueryKeys.personTravelSnapshot(personId ?? ""),
    queryFn: async () => {
      if (!personId) throw new Error("usePersonTravelSnapshot requires a personId")
      return fetchWithValidation(
        `/v1/crm/people/${personId}/travel-snapshot`,
        personTravelSnapshotResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(personId),
    staleTime: 30_000,
  })
}
