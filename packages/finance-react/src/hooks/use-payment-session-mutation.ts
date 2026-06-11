"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { type PaymentMethod, paymentSessionSingleResponse } from "../schemas.js"

export interface CompletePaymentSessionInput {
  /** Defaults to `"paid"` server-side. */
  status?: "authorized" | "paid"
  /** Defaults to `"manual"` server-side. */
  captureMode?: "automatic" | "manual"
  paymentMethod?: PaymentMethod | null
  paymentInstrumentId?: string | null
  providerSessionId?: string | null
  providerPaymentId?: string | null
  externalReference?: string | null
  referenceNumber?: string | null
  paymentDate?: string | null
  authorizedAt?: string | null
  capturedAt?: string | null
  settledAt?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

export interface CancelPaymentSessionInput {
  notes?: string | null
  cancelledAt?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Admin payment-session transitions
 * (`POST /v1/admin/finance/payment-sessions/:id/complete` and `/cancel`).
 * Completing a session settles its invoice/payment side effects
 * server-side, so payment + invoice lists are invalidated alongside the
 * session list; callers that render booking-scoped surfaces should also
 * invalidate their booking keys on success.
 */
export function usePaymentSessionMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: financeQueryKeys.paymentSessions() })
    void queryClient.invalidateQueries({ queryKey: financeQueryKeys.allPayments() })
    void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
  }

  const complete = useMutation({
    mutationFn: async ({ id, input = {} }: { id: string; input?: CompletePaymentSessionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/payment-sessions/${id}/complete`,
        paymentSessionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const cancel = useMutation({
    mutationFn: async ({ id, input = {} }: { id: string; input?: CancelPaymentSessionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/payment-sessions/${id}/cancel`,
        paymentSessionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { complete, cancel }
}
