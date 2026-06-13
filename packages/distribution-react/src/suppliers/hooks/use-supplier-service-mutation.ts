"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { deleteSuccessResponse, supplierServiceResponse } from "../schemas.js"

export interface CreateSupplierServiceInput {
  serviceType: "accommodation" | "transfer" | "experience" | "guide" | "meal" | "other"
  name: string
  description?: string | null
  duration?: string | null
  capacity?: number | null
  active?: boolean
  tags?: string[]
}

export type UpdateSupplierServiceInput = Partial<CreateSupplierServiceInput>

export function useSupplierServiceMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateSupplierServiceInput) => {
      const { data } = await fetchWithValidation(
        `/v1/suppliers/${supplierId}/services`,
        supplierServiceResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: suppliersQueryKeys.supplierServices(supplierId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      serviceId,
      input,
    }: {
      serviceId: string
      input: UpdateSupplierServiceInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/suppliers/${supplierId}/services/${serviceId}`,
        supplierServiceResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: suppliersQueryKeys.supplierServices(supplierId),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async (serviceId: string) =>
      fetchWithValidation(
        `/v1/suppliers/${supplierId}/services/${serviceId}`,
        deleteSuccessResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_result, serviceId) => {
      void queryClient.invalidateQueries({
        queryKey: suppliersQueryKeys.supplierServices(supplierId),
      })
      queryClient.removeQueries({
        queryKey: suppliersQueryKeys.supplierServiceRates(supplierId, serviceId),
      })
    },
  })

  return { create, update, remove }
}
