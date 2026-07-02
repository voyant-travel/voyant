"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import type { SupplierAvailabilityFilters } from "../query-keys.js"
import { getSupplierAvailabilityQueryOptions } from "../query-options.js"

export interface UseSupplierAvailabilityOptions extends SupplierAvailabilityFilters {
  enabled?: boolean
}

export function useSupplierAvailability(
  supplierId: string,
  options: UseSupplierAvailabilityOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  const { enabled = true, ...filters } = options
  return useQuery({
    ...getSupplierAvailabilityQueryOptions({ baseUrl, fetcher }, supplierId, filters),
    enabled,
  })
}
