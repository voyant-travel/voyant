import type { UpdateMediaAssetInput } from "@voyant-travel/media/validation"
/** Edit an asset (name / alt / tags / folder membership). */
export declare function useUpdateAsset(): import("@tanstack/react-query").UseMutationResult<
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
  {
    assetId: string
    input: UpdateMediaAssetInput
  },
  unknown
>
