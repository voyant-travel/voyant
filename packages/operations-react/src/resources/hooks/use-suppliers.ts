"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantResourcesContext } from "../provider.js"
import type { PaginationFilters } from "../query-keys.js"
import { getSuppliersQueryOptions } from "../query-options.js"

export interface UseSuppliersOptions extends PaginationFilters {
  enabled?: boolean
}

export function useSuppliers(options: UseSuppliersOptions = {}) {
  const client = useVoyantResourcesContext()
  const { enabled = true } = options

  return useQuery({
    ...getSuppliersQueryOptions(client, options),
    enabled,
  })
}
