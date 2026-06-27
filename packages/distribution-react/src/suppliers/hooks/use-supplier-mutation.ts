"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import {
  deleteSuccessResponse,
  type SupplierCustomerPaymentPolicy,
  supplierDetailResponse,
} from "../schemas.js"

export interface CreateSupplierInput {
  name: string
  type: "hotel" | "transfer" | "guide" | "experience" | "airline" | "restaurant" | "other"
  status?: "active" | "inactive" | "pending"
  description?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  defaultCurrency?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  paymentTermsDays?: number | null
  reservationTimeoutMinutes?: number | null
  customerPaymentPolicy?: SupplierCustomerPaymentPolicy | null
  tags?: string[]
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>

export function useSupplierMutation() {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateSupplierInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/suppliers",
        supplierDetailResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.suppliers() })
      queryClient.setQueryData(suppliersQueryKeys.supplierDetail(data.id), { data })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSupplierInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/${id}`,
        supplierDetailResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.suppliers() })
      queryClient.setQueryData(suppliersQueryKeys.supplierDetail(data.id), { data })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/suppliers/${id}`,
        deleteSuccessResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.suppliers() })
      queryClient.removeQueries({ queryKey: suppliersQueryKeys.supplierDetail(id) })
      queryClient.removeQueries({ queryKey: suppliersQueryKeys.supplierServices(id) })
      queryClient.removeQueries({ queryKey: suppliersQueryKeys.supplierNotes(id) })
      void queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.rates() })
    },
  })

  return { create, update, remove }
}
