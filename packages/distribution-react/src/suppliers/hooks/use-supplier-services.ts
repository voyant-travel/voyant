"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierServicesQueryOptions } from "../query-options.js"

export interface UseSupplierServicesOptions {
  enabled?: boolean
}

export function useSupplierServices(supplierId: string, options: UseSupplierServicesOptions = {}) {
  const client = useVoyantSuppliersContext()
  const { enabled = true } = options
  return useQuery({
    ...getSupplierServicesQueryOptions(client, supplierId),
    enabled: enabled && !!supplierId,
  })
}
