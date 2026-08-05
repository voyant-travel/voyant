"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getBookingPaymentDisputesQueryOptions } from "../query-options.js"

export interface UseBookingPaymentDisputesOptions {
  enabled?: boolean
}

/**
 * The booking's card disputes (voyant#4289).
 *
 * A contested payment still reads `paid` everywhere else, so this is the read
 * that tells a cleanly paid booking from one whose money is being taken back.
 */
export function useBookingPaymentDisputes(
  bookingId: string | null | undefined,
  options: UseBookingPaymentDisputesOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getBookingPaymentDisputesQueryOptions({ baseUrl, fetcher }, bookingId),
    enabled: enabled && Boolean(bookingId),
  })
}
