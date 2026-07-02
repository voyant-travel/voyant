"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import { personPaymentMethodListResponse } from "../schemas.js"

export interface UsePersonPaymentMethodsOptions {
  enabled?: boolean
}

export function usePersonPaymentMethods(
  personId: string | undefined,
  options: UsePersonPaymentMethodsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.personPaymentMethods(personId ?? ""),
    queryFn: async () => {
      if (!personId) throw new Error("usePersonPaymentMethods requires a personId")
      return fetchWithValidation(
        `/v1/admin/relationships/people/${personId}/payment-methods`,
        personPaymentMethodListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(personId),
  })
}
