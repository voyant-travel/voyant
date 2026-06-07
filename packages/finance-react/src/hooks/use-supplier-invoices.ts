"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import type { FinanceSupplierInvoiceListFilters } from "../query-keys.js"
import { getSupplierInvoicesQueryOptions } from "../query-options.js"

export interface UseSupplierInvoicesOptions extends FinanceSupplierInvoiceListFilters {
  enabled?: boolean
}

export function useSupplierInvoices(options: UseSupplierInvoicesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getSupplierInvoicesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
