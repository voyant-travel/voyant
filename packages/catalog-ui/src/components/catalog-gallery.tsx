"use client"

import { Dialog, DialogContent } from "@voyantjs/ui/components/dialog"
import { cn } from "@voyantjs/ui/lib/utils"
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, X } from "lucide-react"
import { useEffect } from "react"

/**
 * Shared catalog gallery + lightbox — the Booking.com-style mosaic and
 * full-screen viewer used by every catalog detail page (packages, cruises, …)
 * so they all look identical. Layout/lightbox logic lives here once.
 */

export interface GalleryImage {
  src: string
  caption?: string | null
}

export interface GalleryLightboxLabels {
  close: string
  prev: string
  next: string
}

function GalleryImg({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
    />
  )
}

function PhotosBadge({ count, label }: { count: number; label: string }) {
  if (count <= 1) return null
  return (
    <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs shadow-sm backdrop-blur">
      <Maximize2 className="h-3.5 w-3.5" /> {count} {label}
    </span>
  )
}

// Booking.com-style gallery mosaic — gap-free for any image count; every tile
// opens the lightbox at its index. Tuned for the common case (many photos)
// with graceful layouts for 1–4.
export function Gallery({
  images,
  photosLabel,
  onOpen,
}: {
  images: GalleryImage[]
  photosLabel: string
  onOpen: (index: number) => void
}) {
  const first = images[0]
  if (!first) {
    return (
      <div className="flex aspect-[21/9] w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <ImageIcon className="h-10 w-10" aria-hidden="true" />
      </div>
    )
  }
  const tile =
    "group relative overflow-hidden bg-muted transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  if (images.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpen(0)}
        className={cn(tile, "block aspect-[21/9] w-full rounded-xl")}
      >
        <GalleryImg src={first.src} />
      </button>
    )
  }
  if (images.length === 2) {
    return (
      <div className="grid h-[300px] grid-cols-2 gap-2 sm:h-[380px]">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => onOpen(i)}
            className={cn(tile, "rounded-xl")}
          >
            <GalleryImg src={img.src} />
            {i === 0 && <PhotosBadge count={images.length} label={photosLabel} />}
          </button>
        ))}
      </div>
    )
  }
  if (images.length === 3) {
    return (
      <div className="grid h-[340px] grid-cols-2 grid-rows-2 gap-2 sm:h-[420px]">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className={cn(tile, "row-span-2 rounded-xl")}
        >
          <GalleryImg src={first.src} />
          <PhotosBadge count={images.length} label={photosLabel} />
        </button>
        {images.slice(1, 3).map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => onOpen(i + 1)}
            className={cn(tile, "rounded-lg")}
          >
            <GalleryImg src={img.src} />
          </button>
        ))}
      </div>
    )
  }
  if (images.length === 4) {
    return (
      <div className="grid h-[340px] grid-cols-2 grid-rows-2 gap-2 sm:h-[420px]">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => onOpen(i)}
            className={cn(tile, "rounded-lg")}
          >
            <GalleryImg src={img.src} />
            {i === 0 && <PhotosBadge count={images.length} label={photosLabel} />}
          </button>
        ))}
      </div>
    )
  }
  // 5+: hero (2×2) + four tiles; the last tile shows "+N" when there are more.
  const side = images.slice(1, 5)
  const more = images.length - 5
  return (
    <div className="grid h-[340px] grid-cols-4 grid-rows-2 gap-2 sm:h-[440px]">
      <button
        type="button"
        onClick={() => onOpen(0)}
        className={cn(tile, "col-span-2 row-span-2 rounded-xl")}
      >
        <GalleryImg src={first.src} />
        <PhotosBadge count={images.length} label={photosLabel} />
      </button>
      {side.map((img, i) => (
        <button
          key={img.src}
          type="button"
          onClick={() => onOpen(i + 1)}
          className={cn(tile, "rounded-lg")}
        >
          <GalleryImg src={img.src} />
          {i === side.length - 1 && more > 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 font-medium text-sm text-white">
              +{more} {photosLabel}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// Full-screen image lightbox (base-ui Dialog → Esc, focus trap, scroll lock).
// Arrow keys + on-screen arrows + a thumbnail rail navigate the gallery.
export function GalleryLightbox({
  images,
  index,
  onIndex,
  onClose,
  labels,
}: {
  images: GalleryImage[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  labels: GalleryLightboxLabels
}) {
  const count = images.length
  const go = (dir: 1 | -1) => onIndex((index + dir + count) % count)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex((index + 1) % count)
      else if (e.key === "ArrowLeft") onIndex((index - 1 + count) % count)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, count, onIndex])

  const current = images[index] ?? images[0]
  if (!current) return null
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        // `!` forces the width past the base dialog's `sm:max-w-md`; height is
        // capped below the viewport so it reads as a panel, not full-screen.
        className="flex h-[88vh] max-h-[88vh] w-[95vw]! max-w-[1500px]! flex-col gap-0 rounded-xl border-0 bg-black/95 p-0 ring-0"
      >
        <div className="flex items-center justify-between px-4 py-3 text-white/90">
          <span className="text-sm tabular-nums">
            {index + 1} / {count}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="rounded-md p-1.5 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 pb-2">
          {count > 1 && (
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={labels.prev}
              className="absolute left-3 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <img
            src={current.src}
            alt={current.caption ?? ""}
            className="max-h-full max-w-full object-contain"
          />
          {count > 1 && (
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={labels.next}
              className="absolute right-3 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
        {count > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => onIndex(i)}
                className={cn(
                  "relative h-12 w-16 shrink-0 overflow-hidden rounded transition",
                  i === index ? "ring-2 ring-white" : "opacity-50 hover:opacity-100",
                )}
              >
                <img src={img.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
