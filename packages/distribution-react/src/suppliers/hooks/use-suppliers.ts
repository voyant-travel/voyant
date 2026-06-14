"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import type { SuppliersListFilters } from "../query-keys.js"
import { getSuppliersQueryOptions } from "../query-options.js"

export interface UseSuppliersOptions extends SuppliersListFilters {
  enabled?: boolean
}

export function useSuppliers(options: UseSuppliersOptions = {}) {
  const client = useVoyantSuppliersContext()
  const { enabled = true } = options
  return useQuery({ ...getSuppliersQueryOptions(client, options), enabled })
}
