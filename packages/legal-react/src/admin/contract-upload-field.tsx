"use client"

import { Label } from "@voyant-travel/ui/components"
import { FileText, Upload } from "lucide-react"
import type { DragEvent, RefObject } from "react"

import { formatUploadSize } from "./contract-dialog-fields.js"

export interface ContractUploadFieldProps {
  label: string
  placeholder: string
  selectedFile: File | null
  isDraggingFile: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onSelectedFile: (file: File) => void
  onDraggingFileChange: (dragging: boolean) => void
}

export function ContractUploadField({
  label,
  placeholder,
  selectedFile,
  isDraggingFile,
  fileInputRef,
  onSelectedFile,
  onDraggingFileChange,
}: ContractUploadFieldProps) {
  const onFileDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const file = event.dataTransfer.files?.[0]
    if (file) onSelectedFile(file)
  }

  const onFileDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onDraggingFileChange(true)
  }

  const onFileDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onDraggingFileChange(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDrop={onFileDrop}
        onDragOver={onFileDragOver}
        onDragLeave={onFileDragLeave}
        data-dragging={isDraggingFile}
        className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-colors hover:border-foreground/30 hover:bg-muted/30 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5"
      >
        {selectedFile ? (
          <>
            <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="max-w-full truncate font-medium text-sm">{selectedFile.name}</span>
            <span className="text-muted-foreground text-xs">
              {formatUploadSize(selectedFile.size)}
              {selectedFile.type ? ` - ${selectedFile.type}` : ""}
            </span>
          </>
        ) : (
          <>
            <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (!file) return
          onSelectedFile(file)
          event.currentTarget.value = ""
        }}
      />
    </div>
  )
}
