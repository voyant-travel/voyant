"use client"

import {
  type ProductMediaRecord,
  useProductMedia,
  useProductMediaMutation,
} from "@voyantjs/products-react"
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import { ProductMediaDialog } from "./product-media-dialog"

export interface ProductMediaUploadResult {
  url: string
  name?: string
  mediaType?: ProductMediaRecord["mediaType"]
  storageKey?: string | null
  mimeType?: string | null
  fileSize?: number | null
  altText?: string | null
  sortOrder?: number
  isCover?: boolean
}

export type ProductMediaUploadHandler = (
  file: File,
  context: { productId: string; dayId?: string },
) => Promise<ProductMediaUploadResult> // i18n-literal-ok type signature

export interface ProductMediaSectionProps {
  productId: string
  dayId?: string
  title?: string
  description?: string
  compact?: boolean
  uploadMedia?: ProductMediaUploadHandler
  uploadAccept?: string
}

export function ProductMediaSection({
  productId,
  dayId,
  title,
  description,
  compact = false,
  uploadMedia,
  uploadAccept = "image/*,video/*,application/pdf",
}: ProductMediaSectionProps) {
  const messages = useRegistryProductsMessagesOrDefault()
  const sectionMessages = messages.productMediaSection
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingMedia, setEditingMedia] = React.useState<ProductMediaRecord | undefined>()
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [localOrder, setLocalOrder] = React.useState<ProductMediaRecord[]>([])
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { data, isPending, isError } = useProductMedia(productId, { dayId, limit: 100 })
  const { create, remove, reorder, setCover } = useProductMediaMutation()

  const media = React.useMemo(
    () =>
      (data?.data ?? [])
        .slice()
        .sort(
          (left, right) =>
            Number(right.isCover) - Number(left.isCover) || left.sortOrder - right.sortOrder,
        ),
    [data?.data],
  )

  React.useEffect(() => {
    if (!reorderMode) setLocalOrder(media)
  }, [media, reorderMode])

  const visibleMedia = reorderMode ? localOrder : media
  const resolvedTitle =
    title ?? (dayId ? sectionMessages.titles.dayMedia : sectionMessages.titles.media)
  const resolvedDescription =
    description ??
    (dayId ? sectionMessages.descriptions.dayMedia : sectionMessages.descriptions.media)

  const handleUpload = async (file: File) => {
    if (!uploadMedia) return

    setUploadError(null)
    setIsUploading(true)

    try {
      const uploaded = await uploadMedia(file, { productId, dayId })
      const mimeType = uploaded.mimeType?.trim() || file.type || null
      const inferredMediaType =
        uploaded.mediaType ??
        (mimeType?.startsWith("video/")
          ? "video"
          : mimeType?.startsWith("image/")
            ? "image"
            : "document")

      await create.mutateAsync({
        productId,
        dayId,
        mediaType: inferredMediaType,
        name: uploaded.name?.trim() || file.name,
        url: uploaded.url,
        storageKey: uploaded.storageKey ?? null,
        mimeType,
        fileSize: uploaded.fileSize ?? (file.size || null),
        altText: uploaded.altText ?? null,
        sortOrder: uploaded.sortOrder ?? media.length,
        isCover: uploaded.isCover ?? media.length === 0,
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : sectionMessages.uploadFailed)
    } finally {
      setIsUploading(false)
    }
  }

  const moveMedia = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setLocalOrder((items) => {
      const sourceIndex = items.findIndex((item) => item.id === sourceId)
      const targetIndex = items.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return items
      const next = items.slice()
      const [moved] = next.splice(sourceIndex, 1)
      if (!moved) return items
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const commitReorder = async () => {
    await reorder.mutateAsync({
      productId,
      items: localOrder.map((item, index) => ({ id: item.id, sortOrder: index })),
    })
    setReorderMode(false)
  }

  const cancelReorder = () => {
    setLocalOrder(media)
    setReorderMode(false)
    setDraggedId(null)
  }

  const header = (
    <div className="space-y-1">
      <CardTitle className={compact ? "text-base" : undefined}>{resolvedTitle}</CardTitle>
      <CardDescription>{resolvedDescription}</CardDescription>
    </div>
  )

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {media.length > 1 ? (
        reorderMode ? (
          <>
            <Button
              type="button"
              variant="outline"
              size={compact ? "sm" : "default"}
              onClick={cancelReorder}
              disabled={reorder.isPending}
            >
              {sectionMessages.actions.cancelReorder}
            </Button>
            <Button
              type="button"
              size={compact ? "sm" : "default"}
              onClick={() => void commitReorder()}
              disabled={reorder.isPending}
            >
              {reorder.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {sectionMessages.actions.saveOrder}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => {
              setLocalOrder(media)
              setReorderMode(true)
            }}
          >
            <GripVertical className="mr-2 size-4" aria-hidden="true" />
            {sectionMessages.actions.reorder}
          </Button>
        )
      ) : null}
      {uploadMedia ? (
        <>
          <Button
            type="button"
            variant={compact ? "outline" : "secondary"}
            size={compact ? "sm" : "default"}
            disabled={isUploading || reorderMode}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="mr-2 size-4" aria-hidden="true" />
            )}
            {sectionMessages.actions.upload}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={uploadAccept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleUpload(file)
                event.target.value = ""
              }
            }}
          />
        </>
      ) : null}
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        disabled={reorderMode}
        onClick={() => {
          setEditingMedia(undefined)
          setDialogOpen(true)
        }}
      >
        <Plus className="mr-2 size-4" aria-hidden="true" />
        {sectionMessages.actions.addMedia}
      </Button>
    </div>
  )

  const body = (
    <>
      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
      {isPending ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed">
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">{sectionMessages.loadingError}</p>
      ) : media.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {sectionMessages.empty}
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {sectionMessages.itemCount.replace("{count}", String(media.length))}
          </div>
          <ul
            className={cn(
              "m-0 grid list-none gap-3 p-0",
              compact ? "grid-cols-2" : "sm:grid-cols-2 2xl:grid-cols-3",
            )}
          >
            {visibleMedia.map((item, index) => (
              <MediaTile
                key={item.id}
                item={item}
                index={index}
                compact={compact}
                reorderMode={reorderMode}
                dragging={draggedId === item.id}
                onOpen={() => setLightboxIndex(index)}
                onEdit={() => {
                  setEditingMedia(item)
                  setDialogOpen(true)
                }}
                onSetCover={() => setCover.mutate(item.id)}
                onDelete={() => {
                  if (confirm(sectionMessages.deleteConfirm)) {
                    remove.mutate(item.id)
                  }
                }}
                onDragStart={() => setDraggedId(item.id)}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (draggedId) moveMedia(draggedId, item.id)
                }}
                onDrop={() => setDraggedId(null)}
              />
            ))}
          </ul>
        </>
      )}
    </>
  )

  return (
    <>
      {compact ? (
        <div
          data-slot="product-media-section"
          className="flex flex-col gap-3 rounded-md border bg-background p-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {header}
            {actions}
          </div>
          {body}
        </div>
      ) : (
        <Card data-slot="product-media-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {header}
            {actions}
          </CardHeader>
          <CardContent className="space-y-3">{body}</CardContent>
        </Card>
      )}

      <ProductMediaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={productId}
        dayId={dayId}
        media={editingMedia}
        onSuccess={() => setEditingMedia(undefined)}
      />
      <MediaLightbox
        media={visibleMedia}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  )
}

function MediaTile({
  item,
  index,
  compact,
  reorderMode,
  dragging,
  onOpen,
  onEdit,
  onSetCover,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  item: ProductMediaRecord
  index: number
  compact: boolean
  reorderMode: boolean
  dragging: boolean
  onOpen: () => void
  onEdit: () => void
  onSetCover: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: (event: React.DragEvent<HTMLLIElement>) => void
  onDrop: () => void
}) {
  const messages = useRegistryProductsMessagesOrDefault()
  const sectionMessages = messages.productMediaSection
  const mediaTypeLabel = messages.common.mediaTypeLabels[item.mediaType]

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-md border bg-background transition",
        dragging && "opacity-50 ring-2 ring-primary",
        reorderMode && "cursor-grab active:cursor-grabbing",
      )}
      draggable={reorderMode}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", item.id)
        onDragStart()
      }}
      onDragOver={onDragOver}
      onDragEnd={onDrop}
      onDrop={onDrop}
    >
      <div className={cn("relative bg-muted", compact ? "aspect-[4/3]" : "aspect-video")}>
        {item.mediaType === "image" ? (
          <button
            type="button"
            className="h-full w-full"
            onClick={onOpen}
            disabled={reorderMode}
            aria-label={sectionMessages.actions.openPreview}
          >
            <img
              src={item.url}
              alt={item.altText ?? item.name}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </button>
        ) : item.mediaType === "video" ? (
          <button
            type="button"
            className="flex h-full w-full items-center justify-center"
            onClick={onOpen}
            disabled={reorderMode}
            aria-label={sectionMessages.actions.openPreview}
          >
            <video src={item.url} className="h-full w-full object-cover" muted />
          </button>
        ) : (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground"
            onClick={onOpen}
            disabled={reorderMode}
            aria-label={sectionMessages.actions.openPreview}
          >
            <FileText className="size-6" aria-hidden="true" />
            <span className="text-xs font-medium uppercase">{mediaTypeLabel}</span>
          </button>
        )}

        {item.isCover ? (
          <Badge className="absolute left-2 top-2 gap-1 bg-black/70 text-white hover:bg-black/70">
            <Star className="size-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
            {sectionMessages.coverBadge}
          </Badge>
        ) : null}

        <Badge variant="secondary" className="absolute right-2 top-2 bg-background/90">
          {mediaTypeLabel}
        </Badge>

        {reorderMode ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 px-2 py-1 text-xs text-white">
            <GripVertical className="size-3" aria-hidden="true" />
            {sectionMessages.actions.drag}
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/65 via-black/0 to-black/0 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {!item.isCover ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="pointer-events-auto h-8 px-2 text-xs"
                onClick={onSetCover}
              >
                <Star className="mr-1 size-3" aria-hidden="true" />
                {sectionMessages.actions.markCover}
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="pointer-events-auto"
              onClick={onEdit}
              aria-label={sectionMessages.actions.edit}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="destructive"
              className="pointer-events-auto"
              onClick={onDelete}
              aria-label={sectionMessages.actions.delete}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.name}</div>
            {item.altText ? (
              <div className="truncate text-xs text-muted-foreground">{item.altText}</div>
            ) : null}
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
        </div>
      </div>
    </li>
  )
}

function MediaLightbox({
  media,
  index,
  onClose,
}: {
  media: ProductMediaRecord[]
  index: number | null
  onClose: () => void
}) {
  const messages = useRegistryProductsMessagesOrDefault()
  const sectionMessages = messages.productMediaSection
  const [current, setCurrent] = React.useState(index ?? 0)

  React.useEffect(() => {
    if (index != null) setCurrent(index)
  }, [index])

  const item = media[current]
  const open = index != null && item != null
  const canPrevious = current > 0
  const canNext = current < media.length - 1

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && canPrevious) setCurrent((value) => value - 1)
      if (event.key === "ArrowRight" && canNext) setCurrent((value) => value + 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canNext, canPrevious, open])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="left-0 top-0 h-screen max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-black/90 p-0 text-white ring-0 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{sectionMessages.viewerTitle}</DialogTitle>
        {item ? (
          <div className="relative flex h-full w-full items-center justify-center p-4">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label={sectionMessages.actions.closePreview}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            {canPrevious ? (
              <button
                type="button"
                onClick={() => setCurrent((value) => value - 1)}
                className="absolute left-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label={sectionMessages.actions.previousMedia}
              >
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
            ) : null}
            {canNext ? (
              <button
                type="button"
                onClick={() => setCurrent((value) => value + 1)}
                className="absolute right-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label={sectionMessages.actions.nextMedia}
              >
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            ) : null}

            {item.mediaType === "image" ? (
              <img
                src={item.url}
                alt={item.altText ?? item.name}
                className="max-h-[95vh] max-w-[95vw] object-contain"
              />
            ) : item.mediaType === "video" ? (
              // biome-ignore lint/a11y/useMediaCaption: Admin preview renders uploaded product media and the current model does not provide caption tracks.
              <video src={item.url} controls autoPlay className="max-h-[95vh] max-w-[95vw]" />
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex max-w-md flex-col items-center gap-3 rounded-lg bg-background p-8 text-center text-foreground"
              >
                <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {sectionMessages.actions.openFile}
                </span>
              </a>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
