/** Fetch a single asset by id. */
export declare function useMediaAsset(
  assetId: string | null | undefined,
  options?: {
    enabled?: boolean
  },
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
    }
  }>,
  Error
>
