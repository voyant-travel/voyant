"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantAuthContext } from "../provider.js"
import type { ServiceApiKeysListFilters } from "../query-keys.js"
import { getServiceApiKeysQueryOptions } from "../query-options.js"

export interface UseServiceApiKeysOptions extends ServiceApiKeysListFilters {
  enabled?: boolean
}

export function useServiceApiKeys(options: UseServiceApiKeysOptions = {}) {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getServiceApiKeysQueryOptions(filters, { baseUrl, fetcher }),
    enabled,
  })
}

export type UseApiTokensOptions = UseServiceApiKeysOptions
export const useApiTokens = useServiceApiKeys
