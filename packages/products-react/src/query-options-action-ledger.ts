"use client"

import { queryOptions } from "@tanstack/react-query"

import type { FetchWithValidationOptions } from "./client.js"
import { listProductActionLedger, type ProductActionLedgerListInput } from "./operations.js"
import { productsQueryKeys } from "./query-keys.js"

export interface UseProductActionLedgerOptions extends ProductActionLedgerListInput {
  enabled?: boolean
}

export function getProductActionLedgerQueryOptions(
  client: FetchWithValidationOptions,
  productId: string | null | undefined,
  options: UseProductActionLedgerOptions = {},
) {
  const { enabled: _enabled = true, ...ledgerOptions } = options

  return queryOptions({
    queryKey: productsQueryKeys.productActionLedger(productId ?? "", {
      cursorOccurredAt: ledgerOptions.cursor?.occurredAt,
      cursorId: ledgerOptions.cursor?.id,
      limit: ledgerOptions.limit,
    }),
    queryFn: async () => {
      if (!productId) {
        throw new Error("getProductActionLedgerQueryOptions requires a productId")
      }

      return listProductActionLedger(client, productId, ledgerOptions)
    },
  })
}
