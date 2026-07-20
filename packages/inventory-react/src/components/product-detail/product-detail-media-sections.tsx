import { formatMessage } from "@voyant-travel/i18n"
import type { MediaAsset } from "@voyant-travel/media-react"
import { Button } from "@voyant-travel/ui/components"
import { Download, FileText, RefreshCw } from "lucide-react"
import { useProductDetailMessages } from "./host.js"
import { formatFileSize, Section } from "./product-detail-section-shell.js"
import type { ProductMediaItem } from "./product-detail-shared.js"
import { ProductMediaGallery } from "./product-media-gallery.js"

export function ProductBrochureSection({
  brochure,
  isGenerating,
  generateError,
  onGenerate,
}: {
  brochure: ProductMediaItem | null
  isGenerating: boolean
  generateError?: string | null
  onGenerate: () => void
}) {
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core

  return (
    <Section title={productMessages.brochureTitle}>
      <div className="flex flex-col gap-3">
        {brochure ? (
          <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
            <div className="mt-0.5 rounded-md bg-background p-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{brochure.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatMessage(productMessages.brochureMeta, {
                  version: brochure.brochureVersion ?? 1,
                  size: formatFileSize(brochure.fileSize),
                })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{productMessages.brochureEmpty}</p>
        )}

        <div className="flex gap-2">
          {brochure ? (
            <a href={brochure.url} target="_blank" rel="noreferrer" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {productMessages.downloadBrochure}
              </Button>
            </a>
          ) : null}
          <Button
            variant={brochure ? "secondary" : "default"}
            size="sm"
            className="flex-1"
            disabled={isGenerating}
            onClick={onGenerate}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            {brochure ? productMessages.regenerateBrochure : productMessages.generateBrochure}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{productMessages.brochureSizeHint}</p>
        {generateError ? <p className="text-sm text-destructive">{generateError}</p> : null}
      </div>
    </Section>
  )
}

export function ProductMediaSection({
  productId,
  media,
  isUploading,
  onUpload,
  onSelectFromLibrary,
  onSetCover,
  onDelete,
}: {
  productId: string
  media: ProductMediaItem[]
  isUploading: boolean
  onUpload: (file: File) => void
  onSelectFromLibrary?: (assets: MediaAsset[]) => void
  onSetCover: (mediaId: string) => void
  onDelete: (mediaId: string) => void
}) {
  const messages = useProductDetailMessages()
  return (
    <Section title={messages.products.core.mediaTitle}>
      <div className="flex flex-col gap-4">
        <ProductMediaGallery
          productId={productId}
          media={media}
          isUploading={isUploading}
          onUpload={onUpload}
          onSelectFromLibrary={onSelectFromLibrary}
          onSetCover={onSetCover}
          onDelete={onDelete}
        />
      </div>
    </Section>
  )
}
