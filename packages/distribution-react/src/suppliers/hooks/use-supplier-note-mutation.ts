"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantSuppliersContext } from "../provider.js"
import { suppliersQueryKeys } from "../query-keys.js"
import { supplierNoteResponse } from "../schemas.js"

export interface CreateSupplierNoteInput {
  content: string
}

export function useSupplierNoteMutation(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateSupplierNoteInput) => {
      const { data } = await fetchWithValidation(
        `/v1/suppliers/${supplierId}/notes`,
        supplierNoteResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.supplierNotes(supplierId) })
    },
  })

  return { create }
}
