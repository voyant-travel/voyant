"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantCustomerPortalContext } from "../provider.js"
import { getCustomerPortalContactExistsQueryOptions } from "../query-options.js"

export interface UseCustomerPortalContactExistsOptions {
  enabled?: boolean
}

export function useCustomerPortalContactExists(
  email: string | null | undefined,
  options: UseCustomerPortalContactExistsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantCustomerPortalContext()
  const { enabled = true } = options

  return useQuery({
    ...getCustomerPortalContactExistsQueryOptions({ email: email ?? "" }, { baseUrl, fetcher }),
    enabled: enabled && Boolean(email),
  })
}
