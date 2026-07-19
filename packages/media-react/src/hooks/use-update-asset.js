"use client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateMediaAsset } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"
/** Edit an asset (name / alt / tags / folder membership). */
export function useUpdateAsset() {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, input }) => updateMediaAsset(assetId, input, { baseUrl, fetcher }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: mediaQueryKeys.assets() })
      await queryClient.invalidateQueries({ queryKey: mediaQueryKeys.asset(data.id) })
    },
  })
}
