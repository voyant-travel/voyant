"use client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { deleteMediaAsset } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"
/**
 * Delete an asset. The service guards deletion while the asset is in use and
 * responds `409`; callers can detect that with `isAssetInUseError`.
 */
export function useDeleteAsset() {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assetId) => deleteMediaAsset(assetId, { baseUrl, fetcher }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: mediaQueryKeys.assets() })
      await queryClient.invalidateQueries({ queryKey: mediaQueryKeys.asset(data.id) })
    },
  })
}
