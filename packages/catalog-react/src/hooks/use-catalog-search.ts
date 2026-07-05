"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantCatalogContext } from "../provider.js"
import { type CatalogSearchResponse, catalogSearchResponseSchema } from "../schemas.js"

export type CatalogSearchMode = "keyword" | "hybrid" | "semantic"
export type CatalogSearchSort =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "departure-asc"
  | "newest"
export type CatalogSearchProjection = "raw" | "storefront-card"

export interface CatalogSearchFilter {
  field: string
  // biome-ignore lint/suspicious/noExplicitAny: reason: filter shape mirrors the SearchFilter union from @voyant-travel/catalog
  [key: string]: any
}

export interface UseCatalogSearchOptions {
  vertical: string
  query?: string
  mode?: CatalogSearchMode
  sort?: CatalogSearchSort
  projection?: CatalogSearchProjection
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
  /** Override `defaultScope.channel`. */
  channel?: string
  /**
   * Surface to call against. Operator dashboards pass `"admin"`
   * (default); storefront / partner / embedded surfaces pass
   * `"public"`. Switches the path between
   * `/v1/admin/catalog/search` and `/v1/public/catalog/search`.
   */
  surface?: "admin" | "public"
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
    sort,
    projection,
    filters,
    facets,
    pagination,
    alpha,
    distance_threshold,
    query_embedding,
    market,
    locale,
    channel,
    surface = "admin",
    enabled = true,
    staleTime = 30_000,
  } = options

  return useQuery<CatalogSearchResponse>({
    queryKey: [
      "catalog-search",
      surface,
      vertical,
      query,
      mode,
      sort,
      projection,
      filters,
      facets,
      pagination,
      alpha,
      distance_threshold,
      query_embedding,
      market,
      locale,
      channel,
    ],
    queryFn: () =>
      fetchWithValidation(
        `/v1/${surface}/catalog/search`,
        catalogSearchResponseSchema,
        { baseUrl, fetcher },
        {
          method: "POST",
          body: JSON.stringify({
            vertical,
            query,
            mode,
            sort,
            projection,
            filters,
            facets,
            pagination,
            alpha,
            distance_threshold,
            query_embedding,
            market,
            locale,
            channel,
          }),
        },
      ),
    enabled: enabled && !!vertical,
    staleTime,
    // Keep the previous page/filter's results on screen while the next query
    // loads, so paging/filtering doesn't flash a skeleton or shift layout.
    // `isFetching` + `isPlaceholderData` let the UI show a subtle busy state.
    placeholderData: keepPreviousData,
  })
}
