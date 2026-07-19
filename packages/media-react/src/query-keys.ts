import type { MediaAssetType } from "./schemas.js"

export interface MediaAssetsListFilters {
  type?: MediaAssetType | undefined
  folderId?: string | undefined
  tag?: string | undefined
  mimeType?: string | undefined
  /** Case-insensitive substring match on the asset name. */
  name?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface MediaFoldersListFilters {
  parentId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface AssetUsageListFilters {
  assetId?: string | undefined
  entityType?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const mediaQueryKeys = {
  all: ["voyant", "media-library"] as const,

  assets: () => [...mediaQueryKeys.all, "assets"] as const,
  assetsList: (filters: MediaAssetsListFilters) =>
    [...mediaQueryKeys.assets(), "list", filters] as const,
  asset: (id: string) => [...mediaQueryKeys.assets(), "detail", id] as const,

  folders: () => [...mediaQueryKeys.all, "folders"] as const,
  foldersList: (filters: MediaFoldersListFilters) =>
    [...mediaQueryKeys.folders(), "list", filters] as const,
  folder: (id: string) => [...mediaQueryKeys.folders(), "detail", id] as const,

  usage: () => [...mediaQueryKeys.all, "usage"] as const,
  usageList: (filters: AssetUsageListFilters) =>
    [...mediaQueryKeys.usage(), "list", filters] as const,
  assetUsage: (assetId: string) => [...mediaQueryKeys.usage(), "asset", assetId] as const,
} as const
