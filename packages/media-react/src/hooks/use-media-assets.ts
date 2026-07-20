"use client"

import { useQuery } from "@tanstack/react-query"

import { listMediaAssets } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { type MediaAssetsListFilters, mediaQueryKeys } from "../query-keys.js"

export interface UseMediaAssetsOptions extends MediaAssetsListFilters {
  enabled?: boolean
}

/** List/search catalogued assets with the library filters. */
export function useMediaAssets(options: UseMediaAssetsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: mediaQueryKeys.assetsList(filters),
    queryFn: () => listMediaAssets(filters, { baseUrl, fetcher }),
    enabled,
  })
}
