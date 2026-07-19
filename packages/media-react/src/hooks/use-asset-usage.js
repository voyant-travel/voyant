"use client"
import { useQuery } from "@tanstack/react-query"
import { listAssetUsage } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"
/** "Where used" — usage records that reference the given asset. */
export function useAssetUsage(assetId, options = {}) {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const { enabled = true, limit, offset } = options
  return useQuery({
    queryKey: mediaQueryKeys.assetUsage(assetId ?? ""),
    queryFn: () => listAssetUsage({ assetId: assetId, limit, offset }, { baseUrl, fetcher }),
    enabled: enabled && Boolean(assetId),
  })
}
