"use client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { uploadMediaAsset } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"
/** Multipart upload mutation. Writes into the library and invalidates asset lists. */
export function useAssetUpload() {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => uploadMediaAsset(input, { baseUrl, fetcher }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: mediaQueryKeys.assets() })
    },
  })
}
