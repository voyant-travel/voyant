"use client"
import { Button } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Loader2, Upload } from "lucide-react"
import * as React from "react"
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
/** Drag-and-drop + click-to-browse upload target that writes into the library. */
export function MediaUploadDropzone({
  onFiles,
  uploading = false,
  accept,
  multiple = true,
  className,
  compact = false,
}) {
  const messages = useMediaUiMessagesOrDefault()
  const uploadMessages = messages.library.upload
  const inputRef = React.useRef(null)
  const [dragging, setDragging] = React.useState(false)
  const emit = (fileList) => {
    if (!fileList || fileList.length === 0) return
    onFiles(Array.from(fileList))
  }
  return _jsxs("div", {
    "data-slot": "media-upload-dropzone",
    className: cn(
      "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 text-center transition",
      compact ? "p-4" : "p-6",
      dragging && "border-primary bg-primary/5",
      className,
    ),
    onDragOver: (event) => {
      event.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event) => {
      event.preventDefault()
      setDragging(false)
      emit(event.dataTransfer.files)
    },
    children: [
      uploading
        ? _jsx(Loader2, {
            className: "size-5 animate-spin text-muted-foreground",
            "aria-hidden": "true",
          })
        : _jsx(Upload, { className: "size-5 text-muted-foreground", "aria-hidden": "true" }),
      _jsx("p", {
        className: "text-sm text-muted-foreground",
        children: uploading ? uploadMessages.uploading : uploadMessages.dropzone,
      }),
      _jsx(Button, {
        type: "button",
        variant: "outline",
        size: "sm",
        disabled: uploading,
        onClick: () => inputRef.current?.click(),
        children: uploadMessages.browse,
      }),
      !compact
        ? _jsx("p", { className: "text-xs text-muted-foreground", children: uploadMessages.hint })
        : null,
      _jsx("input", {
        ref: inputRef,
        type: "file",
        accept: accept,
        multiple: multiple,
        className: "hidden",
        onChange: (event) => {
          emit(event.target.files)
          event.target.value = ""
        },
      }),
    ],
  })
}
