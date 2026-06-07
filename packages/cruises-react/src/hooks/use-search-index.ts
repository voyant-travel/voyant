import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantCruisesContext } from "../provider.js"
import { cruisesQueryKeys } from "../query-keys.js"
import { singleEnvelope } from "../schemas.js"

const bulkResponseSchema = singleEnvelope(z.object({ upserted: z.number().int() }))
const rebuildResponseSchema = singleEnvelope(
  z.object({
    localUpserted: z.number().int(),
    externalUpserted: z.number().int(),
    externalErrors: z.array(z.object({ adapter: z.string(), error: z.string() })),
  }),
)

export interface SearchIndexBulkEntry {
  source: "local" | "external"
  sourceProvider?: string | null
  sourceRef?: Record<string, unknown> | null
  localCruiseId?: string | null
  slug: string
  name: string
  cruiseType: "ocean" | "river" | "expedition" | "coastal"
  lineName: string
  shipName: string
  nights: number
  embarkPortName?: string | null
  disembarkPortName?: string | null
  regions?: string[]
  themes?: string[]
  earliestDeparture?: string | null
  latestDeparture?: string | null
  departureCount?: number | null
  lowestPriceCents?: number | null
  lowestPriceCurrency?: string | null
  salesStatus?: string | null
  heroImageUrl?: string | null
}

/**
 * Storefront search-index admin actions. Adapters call `bulkUpsert` to push
 * external entries; operators trigger `rebuildAll` to repair drift across
 * both local and external sources.
 */
export function useSearchIndexMutation() {
  const { baseUrl, fetcher } = useVoyantCruisesContext()
  const client = { baseUrl, fetcher }
  const queryClient = useQueryClient()

  const bulkUpsert = useMutation({
    mutationFn: async (entries: SearchIndexBulkEntry[]) => {
      const result = await fetchWithValidation(
        "/v1/admin/cruises/search-index/bulk",
        bulkResponseSchema,
        client,
        { method: "PUT", body: JSON.stringify({ entries }) },
      )
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cruisesQueryKeys.storefront() })
    },
  })

  const remove = useMutation({
    mutationFn: async (entryId: string): Promise<boolean> => {
      const url = `${baseUrl.replace(/\/$/, "")}/v1/admin/cruises/search-index/${encodeURIComponent(entryId)}`
      const res = await fetcher(url, { method: "DELETE" })
      return res.ok
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cruisesQueryKeys.storefront() })
    },
  })

  const rebuildAll = useMutation({
    mutationFn: async () => {
      const result = await fetchWithValidation(
        "/v1/admin/cruises/search-index/rebuild",
        rebuildResponseSchema,
        client,
        { method: "POST" },
      )
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cruisesQueryKeys.storefront() })
    },
  })

  return { bulkUpsert, remove, rebuildAll }
}
