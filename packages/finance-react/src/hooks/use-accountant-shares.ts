"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFinanceContext } from "../provider.js"
import { getAccountantSharesQueryOptions } from "../query-options.js"

export function useAccountantShares() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  return useQuery(getAccountantSharesQueryOptions({ baseUrl, fetcher }))
}
