"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import { getPriceCatalogQueryOptions } from "../query-options.js"

export interface UsePriceCatalogOptions {
  enabled?: boolean
}

export function usePriceCatalog(
  id: string | null | undefined,
  options: UsePriceCatalogOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true } = options

  return useQuery({
    ...getPriceCatalogQueryOptions({ baseUrl, fetcher }, id ?? "__missing__"),
    enabled: enabled && Boolean(id),
  })
}
