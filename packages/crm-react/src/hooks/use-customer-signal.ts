"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import { customerSignalSingleResponse } from "../schemas.js"

export interface UseCustomerSignalOptions {
  enabled?: boolean
}

export function useCustomerSignal(id: string | undefined, options: UseCustomerSignalOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: crmQueryKeys.customerSignal(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("useCustomerSignal requires an id")
      const { data } = await fetchWithValidation(
        `/v1/crm/customer-signals/${id}`,
        customerSignalSingleResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
