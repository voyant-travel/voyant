"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { deleteSuccessResponse, supplierRateResponse } from "../schemas.js"

export interface CreateSupplierRateInput {
  name: string
  currency: string
  amountCents: number
  unit: "per_person" | "per_group" | "per_night" | "per_vehicle" | "flat"
  validFrom?: string | null
  validTo?: string | null
  minPax?: number | null
  maxPax?: number | null
  notes?: string | null
}

export type UpdateSupplierRateInput = Partial<CreateSupplierRateInput>

export function useSupplierRateMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      serviceId,
      input,
    }: {
      serviceId: string
      input: CreateSupplierRateInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/suppliers/${supplierId}/services/${serviceId}/rates`,
        supplierRateResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, { serviceId }) => {
      void queryClient.invalidateQueries({
        queryKey: suppliersQueryKeys.supplierServiceRates(supplierId, serviceId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      serviceId,
      rateId,
      input,
    }: {
      serviceId: string
      rateId: string
      input: UpdateSupplierRateInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/suppliers/${supplierId}/services/${serviceId}/rates/${rateId}`,
        supplierRateResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, { serviceId }) => {
      void queryClient.invalidateQueries({
        queryKey: suppliersQueryKeys.supplierServiceRates(supplierId, serviceId),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async ({ serviceId, rateId }: { serviceId: string; rateId: string }) =>
      fetchWithValidation(
        `/v1/suppliers/${supplierId}/services/${serviceId}/rates/${rateId}`,
        deleteSuccessResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, { serviceId }) => {
      void queryClient.invalidateQueries({
        queryKey: suppliersQueryKeys.supplierServiceRates(supplierId, serviceId),
      })
    },
  })

  return { create, update, remove }
}
