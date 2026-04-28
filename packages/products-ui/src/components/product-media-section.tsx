"use client"

import {
  type ProductMediaRecord,
  useProductMedia,
  useProductMediaMutation,
} from "@voyantjs/products-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ImageIcon, Loader2, Pencil, Plus, Star, Trash2, Upload } from "lucide-react"
import * as React from "react"

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
) => Promise<ProductMediaUploadResult>

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
  title = dayId ? "Day media" : "Media",
  description = dayId
    ? "Manage media attached to this itinerary day."
    : "Manage product-level media assets and cover selection.",
  compact = false,
  uploadMedia,
  uploadAccept = "image/*,video/*,application/pdf",
}: ProductMediaSectionProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingMedia, setEditingMedia] = React.useState<ProductMediaRecord | undefined>()
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { data, isPending, isError } = useProductMedia(productId, { dayId, limit: 100 })
  const { create, remove, setCover } = useProductMediaMutation()

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

  const header = (
    <div className="space-y-1">
      <CardTitle className={compact ? "text-base" : undefined}>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </div>
  )

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
      setUploadError(error instanceof Error ? error.message : "Failed to upload media.")
    } finally {
      setIsUploading(false)
    }
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {uploadMedia ? (
        <>
          <Button
            variant={compact ? "outline" : "secondary"}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="mr-2 size-4" aria-hidden="true" />
            )}
            Upload
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
        onClick={() => {
          setEditingMedia(undefined)
          setDialogOpen(true)
        }}
      >
        <Plus className="mr-2 size-4" aria-hidden="true" />
        Add media
      </Button>
    </div>
  )

  const body = (
    <>
      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
      {isPending ? (
        <div className="flex min-h-24 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load media.</p>
      ) : media.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media items configured yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {media.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.altText ? (
                          <div className="text-xs text-muted-foreground">{item.altText}</div>
                        ) : null}
                      </div>
                      {item.isCover ? <Badge>Cover</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {item.mediaType}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm text-primary underline-offset-4 hover:underline"
                    >
                      {item.url}
                    </a>
                  </TableCell>
                  <TableCell>{item.sortOrder}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {!item.isCover ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setCover.mutate(item.id)}
                        >
                          <Star className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditingMedia(item)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm("Delete this media item?")) {
                            remove.mutate(item.id)
                          }
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
          <CardContent>{body}</CardContent>
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
    </>
  )
}
