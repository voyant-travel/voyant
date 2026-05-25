"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { type PaymentMethod, type PaymentStatus, paymentRecordSchema } from "../schemas.js"

export interface UpdatePaymentInput {
  amountCents?: number
  currency?: string
  baseCurrency?: string | null
  baseAmountCents?: number | null
  fxRateSetId?: string | null
  paymentMethod?: PaymentMethod
  status?: PaymentStatus
  referenceNumber?: string | null
  paymentDate?: string
  notes?: string | null
}

const paymentSingleResponse = z.object({
  data: paymentRecordSchema,
})

function invalidatePaymentScopes(
  queryClient: ReturnType<typeof useQueryClient>,
  invoiceId: string | null,
  paymentId: string,
) {
  void queryClient.invalidateQueries({ queryKey: financeQueryKeys.allPayments() })
  void queryClient.invalidateQueries({ queryKey: financeQueryKeys.payment(paymentId) })
  if (invoiceId) {
    void queryClient.invalidateQueries({ queryKey: financeQueryKeys.payments(invoiceId) })
    void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoice(invoiceId) })
  }
  // The BookingPaymentsSummary card on the booking detail page is keyed
  // by bookingId, which the PATCH/DELETE response doesn't surface. Use
  // prefix invalidation so every booking-payments query refetches —
  // cheap because each query is per-booking and short.
  void queryClient.invalidateQueries({
    queryKey: [...financeQueryKeys.all, "admin-booking-payments"],
  })
  void queryClient.invalidateQueries({
    queryKey: [...financeQueryKeys.publicCheckout(), "booking-payments"],
  })
}

/**
 * Mutations for an already-recorded customer payment.
 *
 * `useInvoicePaymentMutation(invoiceId)` covers create; update + delete
 * route through `/v1/admin/finance/payments/:id` and recompute invoice totals
 * server-side, so callers don't need to refresh the invoice manually —
 * onSuccess invalidates the invoice and payment list queries.
 */
export function usePaymentMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePaymentInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/payments/${id}`,
        paymentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidatePaymentScopes(queryClient, data.invoiceId, data.id)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/payments/${id}`,
        paymentSingleResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
      return data
    },
    onSuccess: (data) => {
      invalidatePaymentScopes(queryClient, data.invoiceId, data.id)
    },
  })

  return { update, remove }
}
