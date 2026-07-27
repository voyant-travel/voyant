"use client"

import { ImageOff } from "lucide-react"
import type * as React from "react"
import { useState } from "react"

import { cn } from "../lib/utils.js"

/**
 * Drop-in `<img>` replacement that renders a neutral placeholder icon when the
 * source is missing or fails to load, instead of the browser's broken-image
 * glyph and leaked alt text. Layout classes passed via `className` are applied
 * to both the image and the placeholder so the surrounding grid does not shift
 * when an asset goes missing.
 */
function Image({
  className,
  fallbackClassName,
  iconClassName,
  src,
  alt,
  onError,
  ...props
}: React.ComponentProps<"img"> & {
  fallbackClassName?: string
  iconClassName?: string
}) {
  // Track which source failed rather than a plain boolean, so swapping in a
  // different asset re-arms the image without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== undefined && failedSrc === src

  if (!src || failed) {
    return (
      <div
        data-slot="image-fallback"
        role="img"
        aria-label={alt || undefined}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
          fallbackClassName,
        )}
      >
        <ImageOff className={cn("size-6", iconClassName)} aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      data-slot="image"
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailedSrc(src)
        onError?.(event)
      }}
      {...props}
    />
  )
}

export { Image }
