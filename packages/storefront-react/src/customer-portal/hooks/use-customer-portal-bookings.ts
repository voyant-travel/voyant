"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantCustomerPortalContext } from "../provider.js"
import { getCustomerPortalBookingsQueryOptions } from "../query-options.js"

export interface UseCustomerPortalBookingsOptions {
  enabled?: boolean
}

export function useCustomerPortalBookings(options: UseCustomerPortalBookingsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantCustomerPortalContext()
  const { enabled = true } = options

  return useQuery({
    ...getCustomerPortalBookingsQueryOptions({ baseUrl, fetcher }),
    enabled,
  })
}
