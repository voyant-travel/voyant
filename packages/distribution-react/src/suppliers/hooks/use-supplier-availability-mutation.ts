"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { supplierAvailabilityResponse } from "../schemas.js"

export interface UpsertSupplierAvailabilityInput {
  date: string
  available?: boolean
  notes?: string | null
}

export function useSupplierAvailabilityMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  const upsert = useMutation({
    mutationFn: async (
      input: UpsertSupplierAvailabilityInput | UpsertSupplierAvailabilityInput[],
    ) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/availability`,
        supplierAvailabilityResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: suppliersQueryKeys.availability(),
      })
    },
  })

  return { upsert }
}
