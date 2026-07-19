"use client"

import { cn } from "@voyant-travel/ui/lib/utils"
import { FileText, Film } from "lucide-react"

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
export function MediaAssetThumbnail({ asset, url, className }: MediaAssetThumbnailProps) {
  if (asset.type === "image") {
    return (
      <img
        src={url}
        alt={asset.alt ?? asset.name}
        className={cn("h-full w-full object-cover", className)}
        draggable={false}
        loading="lazy"
      />
    )
  }

  if (asset.type === "video") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <Film className="size-6" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
        className,
      )}
    >
      <FileText className="size-6" aria-hidden="true" />
    </div>
  )
}
