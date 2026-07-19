"use client"
import { useQuery } from "@tanstack/react-query"
import { getMediaAsset } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"
/** Fetch a single asset by id. */
export function useMediaAsset(assetId, options = {}) {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const { enabled = true } = options
  return useQuery({
    queryKey: mediaQueryKeys.asset(assetId ?? ""),
    queryFn: () => getMediaAsset(assetId, { baseUrl, fetcher }),
    enabled: enabled && Boolean(assetId),
  })
}
