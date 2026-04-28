"use client"

import { type ProductMediaRecord, useProductMediaMutation } from "@voyantjs/products-react"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Switch } from "@voyantjs/ui/components/switch"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { Loader2 } from "lucide-react"
import * as React from "react"

type MediaType = ProductMediaRecord["mediaType"]

type Mode =
  | { kind: "create"; productId: string; dayId?: string }
  | { kind: "edit"; media: ProductMediaRecord }

export interface ProductMediaFormProps {
  mode: Mode
  onSuccess?: (media: ProductMediaRecord) => void
  onCancel?: () => void
}

interface FormState {
  mediaType: MediaType
  name: string
  url: string
  storageKey: string
  mimeType: string
  fileSize: string
  altText: string
  sortOrder: string
  isCover: boolean
}

const MEDIA_TYPES: Array<{ value: MediaType; label: string }> = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
]

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    return {
      mediaType: mode.media.mediaType,
      name: mode.media.name,
      url: mode.media.url,
      storageKey: mode.media.storageKey ?? "",
      mimeType: mode.media.mimeType ?? "",
      fileSize: mode.media.fileSize == null ? "" : String(mode.media.fileSize),
      altText: mode.media.altText ?? "",
      sortOrder: String(mode.media.sortOrder),
      isCover: mode.media.isCover,
    }
  }

  return {
    mediaType: "image",
    name: "",
    url: "",
    storageKey: "",
    mimeType: "",
    fileSize: "",
    altText: "",
    sortOrder: "0",
    isCover: false,
  }
}

export function ProductMediaForm({ mode, onSuccess, onCancel }: ProductMediaFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductMediaMutation()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const field =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setState((previous) => ({ ...previous, [key]: value }))
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError("Media name is required.")
      return
    }
    if (!state.url.trim()) {
      setError("Media URL is required.")
      return
    }

    const payload = {
      mediaType: state.mediaType,
      name: state.name.trim(),
      url: state.url.trim(),
      storageKey: state.storageKey.trim() ? state.storageKey.trim() : null,
      mimeType: state.mimeType.trim() ? state.mimeType.trim() : null,
      fileSize: state.fileSize.trim() ? Number.parseInt(state.fileSize, 10) || 0 : null,
      altText: state.altText.trim() ? state.altText.trim() : null,
      sortOrder: Number.parseInt(state.sortOrder || "0", 10) || 0,
      isCover: state.isCover,
    }

    try {
      const media =
        mode.kind === "create"
          ? await create.mutateAsync({
              productId: mode.productId,
              dayId: mode.dayId,
              ...payload,
            })
          : await update.mutateAsync({ mediaId: mode.media.id, input: payload })
      onSuccess?.(media)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Failed to save media.")
    }
  }

  return (
    <form data-slot="product-media-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Media type</Label>
          <Select
            items={MEDIA_TYPES}
            value={state.mediaType}
            onValueChange={(value) => field("mediaType")(value as MediaType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-media-name">Name</Label>
          <Input
            id="product-media-name"
            autoFocus
            required
            value={state.name}
            onChange={(event) => field("name")(event.target.value)}
            placeholder="Hero image"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-media-url">URL</Label>
        <Input
          id="product-media-url"
          type="url"
          required
          value={state.url}
          onChange={(event) => field("url")(event.target.value)}
          placeholder="https://example.com/media/hero.jpg"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-media-storage-key">Storage key</Label>
          <Input
            id="product-media-storage-key"
            value={state.storageKey}
            onChange={(event) => field("storageKey")(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-media-mime-type">MIME type</Label>
          <Input
            id="product-media-mime-type"
            value={state.mimeType}
            onChange={(event) => field("mimeType")(event.target.value)}
            placeholder="image/jpeg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-media-file-size">File size</Label>
          <Input
            id="product-media-file-size"
            type="number"
            min="0"
            value={state.fileSize}
            onChange={(event) => field("fileSize")(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-media-sort-order">Sort order</Label>
          <Input
            id="product-media-sort-order"
            type="number"
            value={state.sortOrder}
            onChange={(event) => field("sortOrder")(event.target.value)}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch
            checked={state.isCover}
            onCheckedChange={(checked) => field("isCover")(checked)}
          />
          <Label>Cover media</Label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-media-alt-text">Alt text</Label>
        <Textarea
          id="product-media-alt-text"
          value={state.altText}
          onChange={(event) => field("altText")(event.target.value)}
          placeholder="Short accessibility description"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "create" ? "Add media" : "Save media"}
        </Button>
      </div>
    </form>
  )
}
