"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFlightsContext } from "../provider.js"
import { flightsQueryKeys } from "../query-keys.js"
import {
  type SavedPaymentMethodListResponse,
  savedPaymentMethodListResponseSchema,
} from "../schemas.js"

export interface UseSavedPaymentMethodsOptions {
  enabled?: boolean
  staleTime?: number
}

/**
 * GET `/v1/admin/relationships/people/:personId/payment-methods` — list a person's saved
 * payment methods. Backed by the CRM `person_payment_methods` table.
 */
export function useSavedPaymentMethods(
  personId: string | null | undefined,
  options: UseSavedPaymentMethodsOptions = {},
) {
  const client = useVoyantFlightsContext()
  const { enabled = true, staleTime = 30_000 } = options
  return useQuery<SavedPaymentMethodListResponse, Error>({
    queryKey: flightsQueryKeys.savedPaymentMethods(personId ?? ""),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/relationships/people/${encodeURIComponent(personId ?? "")}/payment-methods`,
        savedPaymentMethodListResponseSchema,
        client,
      ),
    enabled: enabled && !!personId,
    staleTime,
  })
}
