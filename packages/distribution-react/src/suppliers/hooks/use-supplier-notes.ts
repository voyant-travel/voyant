"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierNotesQueryOptions } from "../query-options.js"

export interface UseSupplierNotesOptions {
  enabled?: boolean
}

export function useSupplierNotes(supplierId: string, options: UseSupplierNotesOptions = {}) {
  const client = useVoyantSuppliersContext()
  const { enabled = true } = options
  return useQuery({
    ...getSupplierNotesQueryOptions(client, supplierId),
    enabled: enabled && !!supplierId,
  })
}
