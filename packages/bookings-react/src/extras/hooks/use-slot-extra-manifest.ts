"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantExtrasContext } from "../provider.js"
import { getSlotExtraManifestQueryOptions } from "../query-options.js"

export function useSlotExtraManifest(
  slotId: string | null | undefined,
  options = { enabled: true },
) {
  const { baseUrl, fetcher } = useVoyantExtrasContext()

  return useQuery({
    ...getSlotExtraManifestQueryOptions({ baseUrl, fetcher }, slotId ?? ""),
    enabled: options.enabled && Boolean(slotId),
  })
}
