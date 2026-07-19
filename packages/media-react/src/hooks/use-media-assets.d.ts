import { type MediaAssetsListFilters } from "../query-keys.js"
export interface UseMediaAssetsOptions extends MediaAssetsListFilters {
  enabled?: boolean
}
/** List/search catalogued assets with the library filters. */
export declare function useMediaAssets(
  options?: UseMediaAssetsOptions,
): import("@tanstack/react-query").UseQueryResult<
  NoInfer<{
    data: {
      id: string
      type: "image" | "video" | "document"
      name: string
      alt: string | null
      storageKey: string
      mimeType: string | null
      fileSize: number | null
      checksum: string
      width: number | null
      height: number | null
      durationMs: number | null
      tags: string[]
      providerMeta: unknown
      createdBy: string | null
      createdAt: string
      updatedAt: string
    }[]
    total: number
    limit: number
    offset: number
  }>,
  Error
>
