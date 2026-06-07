"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getCostCategoriesQueryOptions } from "../query-options.js"

export function useCostCategories(options: { includeArchived?: boolean; enabled?: boolean } = {}) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true, ...rest } = options
  return useQuery({ ...getCostCategoriesQueryOptions({ baseUrl, fetcher }, rest), enabled })
}
