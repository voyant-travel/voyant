"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { creditNoteRecordSchema } from "../schemas.js"

export interface CreateInvoiceCreditNoteInput {
  creditNoteNumber: string
  amountCents: number
  currency: string
  reason: string
  notes?: string | null
}

export type UpdateInvoiceCreditNoteInput = Partial<CreateInvoiceCreditNoteInput> & {
  status?: "draft" | "issued" | "applied"
}

const invoiceCreditNoteSingleResponse = z.object({
  data: creditNoteRecordSchema,
})

export function useInvoiceCreditNoteMutation(invoiceId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateInvoiceCreditNoteInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/invoices/${invoiceId}/credit-notes`,
        invoiceCreditNoteSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.creditNotes(invoiceId) })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoice(invoiceId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateInvoiceCreditNoteInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/invoices/${invoiceId}/credit-notes/${id}`,
        invoiceCreditNoteSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.creditNotes(invoiceId) })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoice(invoiceId) })
    },
  })

  return { create, update }
}
