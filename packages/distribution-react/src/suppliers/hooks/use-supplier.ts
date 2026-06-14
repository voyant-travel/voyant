"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierQueryOptions } from "../query-options.js"

export interface UseSupplierOptions {
  enabled?: boolean
}

export function useSupplier(id: string, options: UseSupplierOptions = {}) {
  const client = useVoyantSuppliersContext()
  const { enabled = true } = options
  return useQuery({ ...getSupplierQueryOptions(client, id), enabled: enabled && !!id })
}
