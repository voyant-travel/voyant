"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSuppliersContext } from "../provider.js"
import { getSupplierContactPointsQueryOptions } from "../query-options.js"

export function useSupplierContactPoints(supplierId: string) {
  const { baseUrl, fetcher } = useVoyantSuppliersContext()
  return useQuery(getSupplierContactPointsQueryOptions({ baseUrl, fetcher }, supplierId))
}
