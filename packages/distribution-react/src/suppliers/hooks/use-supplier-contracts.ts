"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierContractsQueryOptions } from "../query-options.js"

export function useSupplierContracts(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  return useQuery(getSupplierContractsQueryOptions({ baseUrl, fetcher }, supplierId))
}
