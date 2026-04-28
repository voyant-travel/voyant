"use client"

import { File as FileIcon, Loader2, Upload, X } from "lucide-react"
import * as React from "react"

export interface UploadedFile {
  key: string
  url: string
  mimeType: string
  size: number
  name: string
}

export interface FileDropzoneProps {
  /** URL of the upload endpoint (defaults to /api/v1/uploads). */
  uploadUrl?: string
  /** MIME types or extensions to accept (same format as <input accept>). */
  accept?: string
  /** Maximum file size in bytes. */
  maxSize?: number
  /** Called after a successful upload. */
  onUploaded: (file: UploadedFile) => void
  /** Called when an error occurs (validation, upload failure). */
  onError?: (message: string) => void
  /** Helper text shown in the idle state. */
  helperText?: string
  /** Disable interaction. */
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropzone({
  uploadUrl = "/api/v1/uploads",
  accept,
  maxSize,
  onUploaded,
  onError,
  helperText = "Drag and drop a file here, or click to select",
  disabled,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploaded, setUploaded] = React.useState<UploadedFile | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const reportError = (message: string) => {
    setError(message)
    onError?.(message)
  }

  const handleFile = async (file: File) => {
    setError(null)

    if (maxSize && file.size > maxSize) {
      reportError(`File too large (max ${formatSize(maxSize)})`)
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (!res.ok) {
        const body = await res.text()
        reportError(body || `Upload failed (${res.status})`)
        return
      }
      const data = (await res.json()) as Omit<UploadedFile, "name">
      const result: UploadedFile = { ...data, name: file.name }
      setUploaded(result)
      onUploaded(result)
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled || isUploading) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
    e.target.value = ""
  }

  const reset = () => {
    setUploaded(null)
    setError(null)
  }

  if (uploaded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{uploaded.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(uploaded.size)} · {uploaded.mimeType}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled || isUploading}
        data-dragging={isDragging}
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors hover:border-foreground/30 hover:bg-muted/30 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{helperText}</p>
            {accept && <p className="text-xs text-muted-foreground">Accepted: {accept}</p>}
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleChange}
        disabled={disabled || isUploading}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
