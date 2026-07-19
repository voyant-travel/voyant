"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Loader2, Upload } from "lucide-react"
import * as React from "react"

import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"

export interface MediaUploadDropzoneProps {
  onFiles: (files: File[]) => void
  uploading?: boolean
  accept?: string
  multiple?: boolean
  className?: string
  compact?: boolean
}

/** Drag-and-drop + click-to-browse upload target that writes into the library. */
export function MediaUploadDropzone({
  onFiles,
  uploading = false,
  accept,
  multiple = true,
  className,
  compact = false,
}: MediaUploadDropzoneProps) {
  const messages = useMediaUiMessagesOrDefault()
  const uploadMessages = messages.library.upload
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const emit = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    onFiles(Array.from(fileList))
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is an enhancement; the click-to-browse button below is the accessible upload path (voyant#3555)
    <div
      data-slot="media-upload-dropzone"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 text-center transition",
        compact ? "p-4" : "p-6",
        dragging && "border-primary bg-primary/5",
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        emit(event.dataTransfer.files)
      }}
    >
      {uploading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : (
        <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
      )}
      <p className="text-sm text-muted-foreground">
        {uploading ? uploadMessages.uploading : uploadMessages.dropzone}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploadMessages.browse}
      </Button>
      {!compact ? <p className="text-xs text-muted-foreground">{uploadMessages.hint}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          emit(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
}
