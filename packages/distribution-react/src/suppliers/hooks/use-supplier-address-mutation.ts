"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { deleteSuccessResponse, supplierAddressResponse } from "../schemas.js"

export interface CreateSupplierAddressInput {
  label: "primary" | "billing" | "shipping" | "mailing" | "meeting" | "service" | "legal" | "other"
  fullText?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  timezone?: string | null
  isPrimary?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateSupplierAddressInput = Partial<CreateSupplierAddressInput>

export function useSupplierAddressMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  function invalidateSupplierAddresses() {
    void queryClient.invalidateQueries({
      queryKey: suppliersQueryKeys.supplierAddresses(supplierId),
    })
    void queryClient.invalidateQueries({
      queryKey: suppliersQueryKeys.supplierDetail(supplierId),
    })
  }

  const create = useMutation({
    mutationFn: async (input: CreateSupplierAddressInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/addresses`,
        supplierAddressResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierAddresses,
  })

  const update = useMutation({
    mutationFn: async ({
      addressId,
      input,
    }: {
      addressId: string
      input: UpdateSupplierAddressInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/addresses/${addressId}`,
        supplierAddressResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierAddresses,
  })

  const remove = useMutation({
    mutationFn: async (addressId: string) =>
      fetchWithValidation(
        `/v1/admin/suppliers/addresses/${addressId}`,
        deleteSuccessResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidateSupplierAddresses,
  })

  return { create, update, remove }
}
