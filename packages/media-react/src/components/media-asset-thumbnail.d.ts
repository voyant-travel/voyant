import type { MediaAsset } from "../schemas.js"
export interface MediaAssetThumbnailProps {
  asset: MediaAsset
  url: string
  className?: string
}
/**
 * Renders a preview appropriate to the asset kind: an `<img>` for images, a
 * muted `<video>` for videos, and a document glyph for everything else. Purely
 * presentational — no user-facing copy (the alt text comes from the asset).
 */
export declare function MediaAssetThumbnail({
  asset,
  url,
  className,
}: MediaAssetThumbnailProps): import("react").JSX.Element
