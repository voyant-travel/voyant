import { type UploadMediaAssetInput } from "../client.js"
/** Multipart upload mutation. Writes into the library and invalidates asset lists. */
export declare function useAssetUpload(): import("@tanstack/react-query").UseMutationResult<
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
    deduped?: boolean | undefined
  },
  Error,
  UploadMediaAssetInput,
  unknown
>
