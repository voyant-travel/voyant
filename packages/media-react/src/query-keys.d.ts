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
export declare const mediaQueryKeys: {
  readonly all: readonly ["voyant", "media-library"]
  readonly assets: () => readonly ["voyant", "media-library", "assets"]
  readonly assetsList: (
    filters: MediaAssetsListFilters,
  ) => readonly ["voyant", "media-library", "assets", "list", MediaAssetsListFilters]
  readonly asset: (id: string) => readonly ["voyant", "media-library", "assets", "detail", string]
  readonly folders: () => readonly ["voyant", "media-library", "folders"]
  readonly foldersList: (
    filters: MediaFoldersListFilters,
  ) => readonly ["voyant", "media-library", "folders", "list", MediaFoldersListFilters]
  readonly folder: (id: string) => readonly ["voyant", "media-library", "folders", "detail", string]
  readonly usage: () => readonly ["voyant", "media-library", "usage"]
  readonly usageList: (
    filters: AssetUsageListFilters,
  ) => readonly ["voyant", "media-library", "usage", "list", AssetUsageListFilters]
  readonly assetUsage: (
    assetId: string,
  ) => readonly ["voyant", "media-library", "usage", "asset", string]
}
