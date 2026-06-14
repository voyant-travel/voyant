"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantCustomerPortalContext } from "../provider.js"
import { getCustomerPortalBookingQueryOptions } from "../query-options.js"

export interface UseCustomerPortalBookingOptions {
  enabled?: boolean
}

export function useCustomerPortalBooking(
  bookingId: string | null | undefined,
  options: UseCustomerPortalBookingOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantCustomerPortalContext()
  const { enabled = true } = options

  return useQuery({
    ...getCustomerPortalBookingQueryOptions({ baseUrl, fetcher }, bookingId ?? ""),
    enabled: enabled && Boolean(bookingId),
  })
}
