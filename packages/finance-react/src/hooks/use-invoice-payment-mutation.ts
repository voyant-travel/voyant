"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { type PaymentMethod, type PaymentStatus, paymentRecordSchema } from "../schemas.js"

export interface CreateInvoicePaymentInput {
  amountCents: number
  currency: string
  baseCurrency?: string | null
  baseAmountCents?: number | null
  fxRateSetId?: string | null
  paymentMethod: PaymentMethod
  status: PaymentStatus
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
        `/v1/admin/finance/invoices/${invoiceId}/payments`,
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
      // Booking-scoped payment lists (BookingPaymentsSummary in the
      // operator/customer dashboards) are keyed by bookingId, which the
      // POST response doesn't carry. Prefix-invalidate so every active
      // per-booking query refetches — same approach as `usePaymentMutation`.
      void queryClient.invalidateQueries({
        queryKey: [...financeQueryKeys.all, "admin-booking-payments"],
      })
      void queryClient.invalidateQueries({
        queryKey: [...financeQueryKeys.publicCheckout(), "booking-payments"],
      })
    },
  })
}
