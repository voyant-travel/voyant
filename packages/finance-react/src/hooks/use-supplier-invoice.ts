"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getSupplierInvoiceQueryOptions } from "../query-options.js"

export interface UseSupplierInvoiceOptions {
  enabled?: boolean
}

export function useSupplierInvoice(
  id: string | null | undefined,
  options: UseSupplierInvoiceOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getSupplierInvoiceQueryOptions({ baseUrl, fetcher }, id),
    enabled: enabled && Boolean(id),
  })
}
