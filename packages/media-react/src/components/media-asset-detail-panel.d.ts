import * as React from "react"
import type { MediaAsset } from "../schemas.js"
export interface MediaAssetDetailPanelProps {
  asset: MediaAsset
  /** When the library is scoped to a folder, enables "remove from this folder". */
  currentFolderId?: string | undefined
  onDeleted?: (asset: MediaAsset) => void
}
/** Detail + edit surface: rename, alt, tags, folder membership, and "where used". */
export declare function MediaAssetDetailPanel({
  asset,
  currentFolderId,
  onDeleted,
}: MediaAssetDetailPanelProps): React.JSX.Element
