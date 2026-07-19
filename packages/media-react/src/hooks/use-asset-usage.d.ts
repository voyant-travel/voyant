export interface UseAssetUsageOptions {
  enabled?: boolean
  limit?: number
  offset?: number
}
/** "Where used" — usage records that reference the given asset. */
export declare function useAssetUsage(
  assetId: string | null | undefined,
  options?: UseAssetUsageOptions,
): import("@tanstack/react-query").UseQueryResult<
  NoInfer<{
    data: {
      id: string
      assetId: string
      entityType: string
      entityId: string
      createdAt: string
    }[]
    total: number
    limit: number
    offset: number
  }>,
  Error
>
