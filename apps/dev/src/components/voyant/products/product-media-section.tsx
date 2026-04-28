"use client"

import { useProductMedia, useProductMediaMutation } from "@voyantjs/products-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ImageIcon, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react"
import * as React from "react"
import { ProductMediaDialog } from "./product-media-dialog"

export function ProductMediaSection({ productId }: { productId: string }) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingMediaId, setEditingMediaId] = React.useState<string | null>(null)
  const { data, isPending, isError } = useProductMedia(productId, { limit: 100 })
  const { remove, setCover } = useProductMediaMutation()

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
  const editingMedia = React.useMemo(
    () => media.find((item) => item.id === editingMediaId),
    [editingMediaId, media],
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Media</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage product-level media assets and cover selection.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingMediaId(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Add media
        </Button>
      </CardHeader>
      <CardContent>
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
                            setEditingMediaId(item.id)
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

        <ProductMediaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productId={productId}
          media={editingMedia}
          onSuccess={() => {
            setEditingMediaId(null)
            setDialogOpen(false)
          }}
        />
      </CardContent>
    </Card>
  )
}
