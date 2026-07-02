"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { deleteSuccessResponse, supplierContactPointResponse } from "../schemas.js"

export interface CreateSupplierContactPointInput {
  kind: "email" | "phone" | "mobile" | "whatsapp" | "website" | "sms" | "fax" | "social" | "other"
  label?: string | null
  value: string
  normalizedValue?: string | null
  isPrimary?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateSupplierContactPointInput = Partial<CreateSupplierContactPointInput>

export function useSupplierContactPointMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  function invalidateSupplierContactPoints() {
    void queryClient.invalidateQueries({
      queryKey: suppliersQueryKeys.supplierContactPoints(supplierId),
    })
    void queryClient.invalidateQueries({
      queryKey: suppliersQueryKeys.supplierDetail(supplierId),
    })
  }

  const create = useMutation({
    mutationFn: async (input: CreateSupplierContactPointInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contact-points`,
        supplierContactPointResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierContactPoints,
  })

  const update = useMutation({
    mutationFn: async ({
      contactPointId,
      input,
    }: {
      contactPointId: string
      input: UpdateSupplierContactPointInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/contact-points/${contactPointId}`,
        supplierContactPointResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierContactPoints,
  })

  const remove = useMutation({
    mutationFn: async (contactPointId: string) =>
      fetchWithValidation(
        `/v1/admin/suppliers/contact-points/${contactPointId}`,
        deleteSuccessResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidateSupplierContactPoints,
  })

  return { create, update, remove }
}
