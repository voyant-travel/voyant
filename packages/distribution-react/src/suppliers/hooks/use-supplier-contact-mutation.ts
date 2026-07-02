"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { deleteSuccessResponse, supplierNamedContactResponse } from "../schemas.js"

export interface CreateSupplierContactInput {
  role:
    | "general"
    | "primary"
    | "reservations"
    | "operations"
    | "front_desk"
    | "sales"
    | "emergency"
    | "accounting"
    | "legal"
    | "other"
  name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  isPrimary?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateSupplierContactInput = Partial<CreateSupplierContactInput>

export function useSupplierContactMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  function invalidateSupplierContacts() {
    void queryClient.invalidateQueries({
      queryKey: suppliersQueryKeys.supplierContacts(supplierId),
    })
    void queryClient.invalidateQueries({
      queryKey: suppliersQueryKeys.supplierDetail(supplierId),
    })
  }

  const create = useMutation({
    mutationFn: async (input: CreateSupplierContactInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contacts`,
        supplierNamedContactResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierContacts,
  })

  const update = useMutation({
    mutationFn: async ({
      contactId,
      input,
    }: {
      contactId: string
      input: UpdateSupplierContactInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/suppliers/contacts/${contactId}`,
        supplierNamedContactResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidateSupplierContacts,
  })

  const remove = useMutation({
    mutationFn: async (contactId: string) =>
      fetchWithValidation(
        `/v1/admin/suppliers/contacts/${contactId}`,
        deleteSuccessResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidateSupplierContacts,
  })

  return { create, update, remove }
}
