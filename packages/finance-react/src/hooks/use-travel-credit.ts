"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getTravelCreditQueryOptions } from "../query-options.js"

export interface UseTravelCreditOptions {
  enabled?: boolean
}

/**
 * Single Travel Credit + redemption history. The response envelope attaches the
 * full `redemptions[]` list so the operator detail view can render the audit
 * trail in one request.
 */
export function useTravelCredit(
  id: string | null | undefined,
  options: UseTravelCreditOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getTravelCreditQueryOptions({ baseUrl, fetcher }, id),
    enabled: enabled && Boolean(id),
  })
}
