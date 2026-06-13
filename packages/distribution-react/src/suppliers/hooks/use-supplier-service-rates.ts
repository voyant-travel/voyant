"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierServiceRatesQueryOptions } from "../query-options.js"

export interface UseSupplierServiceRatesOptions {
  enabled?: boolean
}

export function useSupplierServiceRates(
  supplierId: string,
  serviceId: string,
  options: UseSupplierServiceRatesOptions = {},
) {
  const client = useVoyantSuppliersContext()
  const { enabled = true } = options
  return useQuery({
    ...getSupplierServiceRatesQueryOptions(client, supplierId, serviceId),
    enabled: enabled && !!supplierId && !!serviceId,
  })
}
