import * as React from "react"
import type { MediaAsset, MediaAssetType } from "../schemas.js"
export interface MediaLibraryProps {
  /**
   * Resolve an asset's byte URL. Defaults to the storage byte-serving route
   * (`{baseUrl}/v1/admin/media/{storageKey}`); override for a CDN/origin.
   */
  resolveAssetUrl?: (asset: MediaAsset) => string
  /** Restrict the whole surface to a single asset type. */
  type?: MediaAssetType
  /** Assets fetched per page (default 60). */
  pageSize?: number
  className?: string
}
/**
 * The full media-library browse surface: folder rail, filters, upload dropzone,
 * an asset grid/list, and a detail panel for the selected asset.
 */
export declare function MediaLibrary({
  resolveAssetUrl,
  type,
  pageSize,
  className,
}: MediaLibraryProps): React.JSX.Element
