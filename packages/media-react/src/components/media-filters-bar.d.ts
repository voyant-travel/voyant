import type { MediaAssetsListFilters } from "../query-keys.js"
export interface MediaFiltersBarProps {
  value: MediaAssetsListFilters
  onChange: (next: MediaAssetsListFilters) => void
  /** Hide the type control (e.g. when the surface is locked to one type). */
  hideType?: boolean
  /** Hide the tag + format controls for a leaner bar (the picker). */
  compact?: boolean
}
/** Filter controls for the library: search, type, tag, and format. */
export declare function MediaFiltersBar({
  value,
  onChange,
  hideType,
  compact,
}: MediaFiltersBarProps): import("react").JSX.Element
