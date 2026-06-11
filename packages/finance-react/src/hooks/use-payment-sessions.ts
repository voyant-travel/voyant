"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinancePaymentSessionListFilters } from "../query-keys.js"
import { getPaymentSessionsQueryOptions } from "../query-options.js"

export interface UsePaymentSessionsOptions extends FinancePaymentSessionListFilters {
  enabled?: boolean
}

/**
 * Admin payment-session list (`GET /v1/admin/finance/payment-sessions`).
 * Filter by `bookingId` + `status: "pending"` to drive the booking detail
 * page's payment-links card.
 */
export function usePaymentSessions(options: UsePaymentSessionsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getPaymentSessionsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
