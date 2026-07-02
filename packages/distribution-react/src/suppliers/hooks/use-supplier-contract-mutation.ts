"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { deleteSuccessResponse, supplierContractResponse } from "../schemas.js"

export interface CreateSupplierContractInput {
  agreementNumber?: string | null
  startDate: string
  endDate?: string | null
  renewalDate?: string | null
  terms?: string | null
  status?: "active" | "expired" | "pending" | "terminated"
}

export type UpdateSupplierContractInput = Partial<CreateSupplierContractInput>

export function useSupplierContractMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  function invalidateSupplierContracts() {
    void queryClient.invalidateQueries({
      queryKey: suppliersQueryKeys.supplierContracts(supplierId),
    })
  }

  const create = useMutation({
    mutationFn: async (input: CreateSupplierContractInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contracts`,
        supplierContractResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierContracts,
  })

  const update = useMutation({
    mutationFn: async ({
      contractId,
      input,
    }: {
      contractId: string
      input: UpdateSupplierContractInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contracts/${contractId}`,
        supplierContractResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierContracts,
  })

  const remove = useMutation({
    mutationFn: async (contractId: string) =>
      fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contracts/${contractId}`,
        deleteSuccessResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidateSupplierContracts,
  })

  return { create, update, remove }
}
