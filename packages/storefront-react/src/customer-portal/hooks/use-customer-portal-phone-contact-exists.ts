"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantCustomerPortalContext } from "../provider.js"
import { getCustomerPortalPhoneContactExistsQueryOptions } from "../query-options.js"

export interface UseCustomerPortalPhoneContactExistsOptions {
  enabled?: boolean
}

export function useCustomerPortalPhoneContactExists(
  phone: string | null | undefined,
  options: UseCustomerPortalPhoneContactExistsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantCustomerPortalContext()
  const { enabled = true } = options

  return useQuery({
    ...getCustomerPortalPhoneContactExistsQueryOptions(
      { phone: phone ?? "" },
      { baseUrl, fetcher },
    ),
    enabled: enabled && Boolean(phone),
  })
}
