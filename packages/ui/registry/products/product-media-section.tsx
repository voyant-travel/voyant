"use client"

import {
  type ProductMediaRecord,
  useProductMedia,
  useProductMediaMutation,
} from "@voyantjs/products-react"
import { ImageIcon, Loader2, Pencil, Plus, Star, Trash2, Upload } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

  const resolvedTitle =
    title ??
    (dayId
      ? messages.productMediaSection.titles.dayMedia
      : messages.productMediaSection.titles.media)
  const resolvedDescription =
    description ??
    (dayId
      ? messages.productMediaSection.descriptions.dayMedia
      : messages.productMediaSection.descriptions.media)

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
      setUploadError(
        error instanceof Error ? error.message : messages.productMediaSection.uploadFailed,
      )
    } finally {
      setIsUploading(false)
    }
  }

  const header = (
    <div className="space-y-1">
      <CardTitle className={compact ? "text-base" : undefined}>{resolvedTitle}</CardTitle>
      <CardDescription>{resolvedDescription}</CardDescription>
    </div>
  )

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
            {messages.productMediaSection.actions.upload}
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
        {messages.productMediaSection.actions.addMedia}
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
        <p className="text-sm text-destructive">{messages.productMediaSection.loadingError}</p>
      ) : media.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.productMediaSection.empty}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.productMediaSection.columns.name}</TableHead>
                <TableHead>{messages.productMediaSection.columns.type}</TableHead>
                <TableHead>{messages.productMediaSection.columns.url}</TableHead>
                <TableHead>{messages.productMediaSection.columns.sort}</TableHead>
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
                      {item.isCover ? (
                        <Badge>{messages.productMediaSection.coverBadge}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {messages.common.mediaTypeLabels[item.mediaType]}
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
                          aria-label={messages.productMediaSection.actions.markCover}
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
                        aria-label={messages.productMediaSection.actions.edit}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(messages.productMediaSection.deleteConfirm)) {
                            remove.mutate(item.id)
                          }
                        }}
                        aria-label={messages.productMediaSection.actions.delete}
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
