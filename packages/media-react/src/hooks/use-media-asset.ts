"use client"

import { useQuery } from "@tanstack/react-query"

import { getMediaAsset } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"

/** Fetch a single asset by id. */
export function useMediaAsset(
  assetId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: mediaQueryKeys.asset(assetId ?? ""),
    queryFn: () => getMediaAsset(assetId as string, { baseUrl, fetcher }),
    enabled: enabled && Boolean(assetId),
  })
}
