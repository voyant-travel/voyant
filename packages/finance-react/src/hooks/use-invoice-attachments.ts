"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getInvoiceAttachmentsQueryOptions } from "../query-options.js"

export interface UseInvoiceAttachmentsOptions {
  enabled?: boolean
}

export function useInvoiceAttachments(
  invoiceId: string | null | undefined,
  options: UseInvoiceAttachmentsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getInvoiceAttachmentsQueryOptions({ baseUrl, fetcher }, invoiceId),
    enabled: enabled && Boolean(invoiceId),
  })
}
