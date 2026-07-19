import * as React from "react"
export interface MediaUploadDropzoneProps {
  onFiles: (files: File[]) => void
  uploading?: boolean
  accept?: string
  multiple?: boolean
  className?: string
  compact?: boolean
}
/** Drag-and-drop + click-to-browse upload target that writes into the library. */
export declare function MediaUploadDropzone({
  onFiles,
  uploading,
  accept,
  multiple,
  className,
  compact,
}: MediaUploadDropzoneProps): React.JSX.Element
