"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getPaymentQueryOptions } from "../query-options.js"

export interface UsePaymentOptions {
  enabled?: boolean
}

export function usePayment(id: string | null | undefined, options: UsePaymentOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getPaymentQueryOptions({ baseUrl, fetcher }, id),
    enabled: enabled && Boolean(id),
  })
}
