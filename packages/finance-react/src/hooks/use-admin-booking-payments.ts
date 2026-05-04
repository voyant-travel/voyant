"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getAdminBookingPaymentsQueryOptions } from "../query-options.js"

export interface UseAdminBookingPaymentsOptions {
  enabled?: boolean
}

/**
 * Admin variant of `usePublicBookingPayments`. Same response shape;
 * targets the admin endpoint so a staff session is authorized to
 * read. Use this from the operator dashboard's booking detail page;
 * the customer-portal stays on the public hook.
 */
export function useAdminBookingPayments(
  bookingId: string | null | undefined,
  options: UseAdminBookingPaymentsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getAdminBookingPaymentsQueryOptions({ baseUrl, fetcher }, bookingId),
    enabled: enabled && Boolean(bookingId),
  })
}
