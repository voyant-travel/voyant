"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { financeNoteRecordSchema } from "../schemas.js"

export interface CreateInvoiceNoteInput {
  content: string
}

const invoiceNoteSingleResponse = z.object({
  data: financeNoteRecordSchema,
})

export function useInvoiceNoteMutation(invoiceId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInvoiceNoteInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/invoices/${invoiceId}/notes`,
        invoiceNoteSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.notes(invoiceId) })
    },
  })
}
