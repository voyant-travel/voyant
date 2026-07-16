"use client"
import { useQuery } from "@tanstack/react-query"
import { useVoyantContext } from "../provider.js"
import { getCustomFieldTargetsQueryOptions } from "../query-options.js"
export function useCustomFieldTargets() {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery(getCustomFieldTargetsQueryOptions({ baseUrl, fetcher }))
}
