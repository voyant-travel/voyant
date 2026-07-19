import type { MediaAsset } from "../schemas.js"
export interface MediaAssetTileProps {
  asset: MediaAsset
  url: string
  selected?: boolean
  onSelect: () => void
  /** Show a selection check affordance (picker / multi-select surfaces). */
  selectable?: boolean
}
/** A single asset card in the grid — the shared tile for the library and picker. */
export declare function MediaAssetTile({
  asset,
  url,
  selected,
  onSelect,
  selectable,
}: MediaAssetTileProps): import("react").JSX.Element
