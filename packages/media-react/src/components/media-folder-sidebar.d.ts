import * as React from "react"
export interface MediaFolderSidebarProps {
  selectedFolderId: string | undefined
  onSelectFolder: (folderId: string | undefined) => void
}
/** Folder rail: "all assets" plus the folder list, with inline create/delete. */
export declare function MediaFolderSidebar({
  selectedFolderId,
  onSelectFolder,
}: MediaFolderSidebarProps): React.JSX.Element
