import type { ReactNode } from "react"
import * as React from "react"
import type { MediaAsset, MediaAssetType } from "../schemas.js"
export interface MediaPickerProps {
  /** Called with the chosen assets when the user confirms a selection. */
  onSelect: (assets: MediaAsset[]) => void
  /** Allow selecting more than one asset. Default single-select. */
  multiple?: boolean
  /** Restrict the picker to a single asset type. */
  type?: MediaAssetType
  /** Render the picker body inline instead of inside a modal dialog. */
  inline?: boolean
  /** Controlled open state (modal variant). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Element that opens the modal (uncontrolled modal variant). */
  trigger?: ReactNode
  /** Resolve an asset's byte URL (defaults to the storage byte-serving route). */
  resolveAssetUrl?: (asset: MediaAsset) => string
  pageSize?: number
  className?: string
}
/**
 * Host-agnostic asset picker other surfaces embed. Supports single/multi
 * select, a locked or user-driven type filter, search, and inline upload that
 * lands in the library and auto-selects. Emits the chosen assets via
 * `onSelect`.
 */
export declare function MediaPicker({
  onSelect,
  multiple,
  type,
  inline,
  open,
  onOpenChange,
  trigger,
  resolveAssetUrl,
  pageSize,
  className,
}: MediaPickerProps): React.JSX.Element
