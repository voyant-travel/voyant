"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { paymentRecordSchema } from "../schemas.js"

export interface CreateInvoicePaymentInput {
  amountCents: number
  currency: string
  baseCurrency?: string | null
  baseAmountCents?: number | null
  fxRateSetId?: string | null
  paymentMethod: "bank_transfer" | "credit_card" | "cash" | "cheque" | "other"
  status: "pending" | "completed" | "failed" | "refunded"
  referenceNumber?: string | null
  paymentDate: string
  notes?: string | null
}

const invoicePaymentSingleResponse = z.object({
  data: paymentRecordSchema,
})

export function useInvoicePaymentMutation(invoiceId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInvoicePaymentInput) => {
      const { data } = await fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/payments`,
        invoicePaymentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.payments(invoiceId) })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoice(invoiceId) })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.allPayments() })
    },
  })
}
