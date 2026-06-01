"use client"

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@voyantjs/ui/components/carousel"
import { Dialog, DialogContent, DialogTitle } from "@voyantjs/ui/components/dialog"
import { ImageIcon } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * Cabin photo gallery: a compact carousel thumbnail that opens a full-screen
 * lightbox carousel on click. Used in the catalog detail sheet's Cabins tab
 * (cruise cabins ship multiple photos). Falls back to a placeholder when a
 * cabin has no images.
 */
export function CabinGallery({ images, alt }: { images: string[]; alt: string }) {
  const [open, setOpen] = useState(false)
  const [startIndex, setStartIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-md bg-muted">
        <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
      </div>
    )
  }

  const openAt = (index: number) => {
    setStartIndex(index)
    setOpen(true)
  }

  return (
    <div className="w-36 shrink-0">
      <Carousel className="group relative" opts={{ loop: images.length > 1 }}>
        <CarouselContent>
          {images.map((src, i) => (
            <CarouselItem key={src}>
              <button
                type="button"
                onClick={() => openAt(i)}
                className="block w-full overflow-hidden rounded-md ring-1 ring-border"
                aria-label={`${alt} — open photo ${i + 1} of ${images.length}`}
              >
                <img
                  src={src}
                  alt={alt}
                  className="h-24 w-36 object-cover transition group-hover:opacity-90"
                  loading="lazy"
                />
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (
          <>
            <CarouselPrevious className="left-1 h-6 w-6 opacity-0 transition group-hover:opacity-100" />
            <CarouselNext className="right-1 h-6 w-6 opacity-0 transition group-hover:opacity-100" />
            <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
              {images.length}
            </span>
          </>
        )}
      </Carousel>

      <CabinLightbox
        images={images}
        alt={alt}
        startIndex={startIndex}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}

function CabinLightbox({
  images,
  alt,
  startIndex,
  open,
  onOpenChange,
}: {
  images: string[]
  alt: string
  startIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(startIndex)

  useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-2 border-0 bg-black/95 p-3 text-white ring-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <Carousel
          // Remount per-open so embla honors the clicked start index.
          key={`${startIndex}-${open}`}
          opts={{ startIndex, loop: images.length > 1 }}
          setApi={setApi}
          className="w-full"
        >
          <CarouselContent>
            {images.map((src, i) => (
              <CarouselItem key={src} className="flex items-center justify-center">
                <img
                  src={src}
                  alt={`${alt} (${i + 1})`}
                  className="max-h-[78vh] w-full rounded object-contain"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {images.length > 1 && (
            <>
              <CarouselPrevious className="left-2 border-0 bg-white/15 text-white hover:bg-white/25" />
              <CarouselNext className="right-2 border-0 bg-white/15 text-white hover:bg-white/25" />
            </>
          )}
        </Carousel>
        {images.length > 1 && (
          <div className="text-center text-xs text-white/70 tabular-nums">
            {current + 1} / {images.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
