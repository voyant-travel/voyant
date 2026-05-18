"use client"

import { queryOptions } from "@tanstack/react-query"

import type { FetchWithValidationOptions } from "./client.js"
import {
  type FinanceActionLedgerListInput,
  listInvoiceActionLedger,
  listPaymentSessionActionLedger,
} from "./operations.js"
import { financeQueryKeys } from "./query-keys.js"

export interface UseFinanceActionLedgerOptions extends FinanceActionLedgerListInput {
  enabled?: boolean
}

export function getInvoiceActionLedgerQueryOptions(
  client: FetchWithValidationOptions,
  invoiceId: string | null | undefined,
  options: UseFinanceActionLedgerOptions = {},
) {
  const { enabled: _enabled = true, ...ledgerOptions } = options

  return queryOptions({
    queryKey: financeQueryKeys.invoiceActionLedger(invoiceId ?? "", {
      cursorOccurredAt: ledgerOptions.cursor?.occurredAt,
      cursorId: ledgerOptions.cursor?.id,
      limit: ledgerOptions.limit,
    }),
    queryFn: async () => {
      if (!invoiceId) {
        throw new Error("getInvoiceActionLedgerQueryOptions requires an invoiceId")
      }

      return listInvoiceActionLedger(client, invoiceId, ledgerOptions)
    },
  })
}

export function getPaymentSessionActionLedgerQueryOptions(
  client: FetchWithValidationOptions,
  paymentSessionId: string | null | undefined,
  options: UseFinanceActionLedgerOptions = {},
) {
  const { enabled: _enabled = true, ...ledgerOptions } = options

  return queryOptions({
    queryKey: financeQueryKeys.paymentSessionActionLedger(paymentSessionId ?? "", {
      cursorOccurredAt: ledgerOptions.cursor?.occurredAt,
      cursorId: ledgerOptions.cursor?.id,
      limit: ledgerOptions.limit,
    }),
    queryFn: async () => {
      if (!paymentSessionId) {
        throw new Error("getPaymentSessionActionLedgerQueryOptions requires a paymentSessionId")
      }

      return listPaymentSessionActionLedger(client, paymentSessionId, ledgerOptions)
    },
  })
}
