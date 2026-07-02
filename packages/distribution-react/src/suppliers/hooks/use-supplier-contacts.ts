"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierContactsQueryOptions } from "../query-options.js"

export function useSupplierContacts(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  return useQuery(getSupplierContactsQueryOptions({ baseUrl, fetcher }, supplierId))
}
