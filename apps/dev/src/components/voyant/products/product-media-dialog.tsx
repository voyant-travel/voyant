"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@voyantjs/ui/components"
import { ProductMediaForm } from "./product-media-form"

type ProductMediaDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  dayId?: string
  media?: {
    id: string
    mediaType: "image" | "video" | "document"
    name: string
    url: string
    storageKey: string | null
    mimeType: string | null
    fileSize: number | null
    altText: string | null
    sortOrder: number
    isCover: boolean
  }
  onSuccess?: () => void
}

export function ProductMediaDialog({
  open,
  onOpenChange,
  productId,
  dayId,
  media,
  onSuccess,
}: ProductMediaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{media ? "Edit media" : "Add media"}</DialogTitle>
        </DialogHeader>
        <ProductMediaForm
          mode={media ? { kind: "edit", media } : { kind: "create", productId, dayId }}
          onSuccess={() => {
            onSuccess?.()
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
