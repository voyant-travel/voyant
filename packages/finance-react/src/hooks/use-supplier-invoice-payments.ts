"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getSupplierInvoicePaymentsQueryOptions } from "../query-options.js"

export interface UseSupplierInvoicePaymentsOptions {
  enabled?: boolean
}

export function useSupplierInvoicePayments(
  id: string | null | undefined,
  options: UseSupplierInvoicePaymentsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getSupplierInvoicePaymentsQueryOptions({ baseUrl, fetcher }, id),
    enabled: enabled && Boolean(id),
  })
}
