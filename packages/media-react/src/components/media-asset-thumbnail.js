"use client"
import { cn } from "@voyant-travel/ui/lib/utils"
import { FileText, Film } from "lucide-react"
import { jsx as _jsx } from "react/jsx-runtime"
/**
 * Renders a preview appropriate to the asset kind: an `<img>` for images, a
 * muted `<video>` for videos, and a document glyph for everything else. Purely
 * presentational — no user-facing copy (the alt text comes from the asset).
 */
export function MediaAssetThumbnail({ asset, url, className }) {
  if (asset.type === "image") {
    return _jsx("img", {
      src: url,
      alt: asset.alt ?? asset.name,
      className: cn("h-full w-full object-cover", className),
      draggable: false,
      loading: "lazy",
    })
  }
  if (asset.type === "video") {
    return _jsx("div", {
      className: cn(
        "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
        className,
      ),
      children: _jsx(Film, { className: "size-6", "aria-hidden": "true" }),
    })
  }
  return _jsx("div", {
    className: cn(
      "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
      className,
    ),
    children: _jsx(FileText, { className: "size-6", "aria-hidden": "true" }),
  })
}
