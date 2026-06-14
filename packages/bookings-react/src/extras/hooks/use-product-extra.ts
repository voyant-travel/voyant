"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantExtrasContext } from "../provider.js"
import { getProductExtraQueryOptions } from "../query-options.js"

export interface UseProductExtraOptions {
  enabled?: boolean
}

export function useProductExtra(
  id: string | null | undefined,
  options: UseProductExtraOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantExtrasContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductExtraQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
