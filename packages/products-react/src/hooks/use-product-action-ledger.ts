"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import {
  getProductActionLedgerQueryOptions,
  type UseProductActionLedgerOptions,
} from "../query-options-action-ledger.js"

export function useProductActionLedger(
  productId: string | null | undefined,
  options: UseProductActionLedgerOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductActionLedgerQueryOptions({ baseUrl, fetcher }, productId, options),
    enabled: enabled && Boolean(productId),
  })
}
