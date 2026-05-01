"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantCatalogContext } from "../provider.js"
import { type CatalogSearchResponse, catalogSearchResponseSchema } from "../schemas.js"

export type CatalogSearchMode = "keyword" | "hybrid" | "semantic"

export interface CatalogSearchFilter {
  field: string
  // biome-ignore lint/suspicious/noExplicitAny: filter shape mirrors the SearchFilter union from @voyantjs/catalog
  [key: string]: any
}

export interface UseCatalogSearchOptions {
  vertical: string
  query?: string
  mode?: CatalogSearchMode
  filters?: CatalogSearchFilter[]
  facets?: Array<{ field: string }>
  pagination?: { limit?: number; cursor?: string }
  /** Hybrid-mode rank-fusion weight (0..1). 0 keyword-only, 1 semantic-only. */
  alpha?: number
  /** Cosine-distance cutoff (0..2) for semantic hits. */
  distance_threshold?: number
  /** Caller-supplied query embedding (skips on-the-fly vectorization). */
  query_embedding?: number[]
  /** Override `defaultScope.market`. */
  market?: string
  /** Override `defaultScope.locale`. */
  locale?: string
  /** Disable the query — useful when `query` is empty and you don't want to hit the network. */
  enabled?: boolean
  /** TanStack Query stale time, milliseconds. Default 30s. */
  staleTime?: number
}

export function useCatalogSearch(options: UseCatalogSearchOptions) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const {
    vertical,
    query = "",
    mode = "keyword",
    filters,
    facets,
    pagination,
    alpha,
    distance_threshold,
    query_embedding,
    market,
    locale,
    enabled = true,
    staleTime = 30_000,
  } = options

  return useQuery<CatalogSearchResponse>({
    queryKey: [
      "catalog-search",
      vertical,
      query,
      mode,
      filters,
      facets,
      pagination,
      alpha,
      distance_threshold,
      query_embedding,
      market,
      locale,
    ],
    queryFn: () =>
      fetchWithValidation(
        "/v1/admin/catalog/search",
        catalogSearchResponseSchema,
        { baseUrl, fetcher },
        {
          method: "POST",
          body: JSON.stringify({
            vertical,
            query,
            mode,
            filters,
            facets,
            pagination,
            alpha,
            distance_threshold,
            query_embedding,
            market,
            locale,
          }),
        },
      ),
    enabled: enabled && !!vertical,
    staleTime,
  })
}
