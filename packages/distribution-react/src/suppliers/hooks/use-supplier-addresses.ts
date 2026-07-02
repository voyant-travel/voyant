"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierAddressesQueryOptions } from "../query-options.js"

export function useSupplierAddresses(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  return useQuery(getSupplierAddressesQueryOptions({ baseUrl, fetcher }, supplierId))
}
