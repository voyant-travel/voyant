"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { lineItemRecordSchema, successEnvelope } from "../schemas.js"

export interface CreateInvoiceLineItemInput {
  description: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  taxRate?: number | null
  sortOrder?: number
}

export type UpdateInvoiceLineItemInput = Partial<CreateInvoiceLineItemInput>

const invoiceLineItemSingleResponse = z.object({
  data: lineItemRecordSchema,
})

export function useInvoiceLineItemMutation(invoiceId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateInvoiceLineItemInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/invoices/${invoiceId}/line-items`,
        invoiceLineItemSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.lineItems(invoiceId) })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoice(invoiceId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateInvoiceLineItemInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/invoices/${invoiceId}/line-items/${id}`,
        invoiceLineItemSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.lineItems(invoiceId) })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoice(invoiceId) })
    },
  })

  const remove = useMutation({
    mutationFn: async (lineItemId: string) =>
      fetchWithValidation(
        `/v1/admin/finance/invoices/${invoiceId}/line-items/${lineItemId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.lineItems(invoiceId) })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoice(invoiceId) })
    },
  })

  return { create, update, remove }
}
