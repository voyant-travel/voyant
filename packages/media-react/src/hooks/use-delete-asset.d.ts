/**
 * Delete an asset. The service guards deletion while the asset is in use and
 * responds `409`; callers can detect that with `isAssetInUseError`.
 */
export declare function useDeleteAsset(): import("@tanstack/react-query").UseMutationResult<
  {
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
  },
  Error,
  string,
  unknown
>
