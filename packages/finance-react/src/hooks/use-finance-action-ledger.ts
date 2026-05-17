"use client"

import { useQuery } from "@tanstack/react-query"
import { useVoyantFinanceContext } from "../provider.js"
import {
  getInvoiceActionLedgerQueryOptions,
  getPaymentSessionActionLedgerQueryOptions,
  type UseFinanceActionLedgerOptions,
} from "../query-options-action-ledger.js"

export function useInvoiceActionLedger(
  invoiceId: string | null | undefined,
  options: UseFinanceActionLedgerOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getInvoiceActionLedgerQueryOptions({ baseUrl, fetcher }, invoiceId, options),
    enabled: enabled && Boolean(invoiceId),
  })
}

export function usePaymentSessionActionLedger(
  paymentSessionId: string | null | undefined,
  options: UseFinanceActionLedgerOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getPaymentSessionActionLedgerQueryOptions({ baseUrl, fetcher }, paymentSessionId, options),
    enabled: enabled && Boolean(paymentSessionId),
  })
}
