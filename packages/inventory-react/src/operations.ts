"use client"

import { type FetchWithValidationOptions, fetchWithValidation, withQueryParams } from "./client.js"
import type { ProductActionLedgerListCursor } from "./query-keys.js"
import { productActionLedgerListResponse } from "./schemas.js"

export interface ProductActionLedgerListInput {
  cursor?: ProductActionLedgerListCursor | null | undefined
  limit?: number | undefined
}

function toProductActionLedgerQuery(input?: ProductActionLedgerListInput) {
  return {
    cursorOccurredAt: input?.cursor?.occurredAt,
    cursorId: input?.cursor?.id,
    limit: input?.limit,
  }
}

export function listProductActionLedger(
  client: FetchWithValidationOptions,
  productId: string,
  input: ProductActionLedgerListInput = {},
) {
  return fetchWithValidation(
    withQueryParams(
      `/v1/admin/products/${productId}/action-ledger`,
      toProductActionLedgerQuery(input),
    ),
    productActionLedgerListResponse,
    client,
  )
}
