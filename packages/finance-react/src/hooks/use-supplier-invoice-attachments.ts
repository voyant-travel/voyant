"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getSupplierInvoiceAttachmentsQueryOptions } from "../query-options.js"

export interface UseSupplierInvoiceAttachmentsOptions {
  enabled?: boolean
}

export function useSupplierInvoiceAttachments(
  id: string | null | undefined,
  options: UseSupplierInvoiceAttachmentsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getSupplierInvoiceAttachmentsQueryOptions({ baseUrl, fetcher }, id),
    enabled: enabled && Boolean(id),
  })
}
