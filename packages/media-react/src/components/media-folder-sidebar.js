"use client"
import { Button } from "@voyant-travel/ui/components/button"
import { Input } from "@voyant-travel/ui/components/input"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Folder, FolderPlus, Library, Loader2, Trash2 } from "lucide-react"
import * as React from "react"
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { useFolderMutation } from "../hooks/use-folder-mutation.js"
import { useFolders } from "../hooks/use-folders.js"
import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
/** Folder rail: "all assets" plus the folder list, with inline create/delete. */
export function MediaFolderSidebar({ selectedFolderId, onSelectFolder }) {
  const messages = useMediaUiMessagesOrDefault()
  const folderMessages = messages.library.folders
  const { data, isPending, isError } = useFolders({ limit: 200 })
  const { create, remove } = useFolderMutation()
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState("")
  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await create.mutateAsync({ name: trimmed })
    setName("")
    setCreating(false)
  }
  return _jsxs("nav", {
    className: "flex w-56 shrink-0 flex-col gap-1",
    "data-slot": "media-folder-sidebar",
    children: [
      _jsxs("div", {
        className: "flex items-center justify-between px-2 py-1",
        children: [
          _jsx("span", {
            className: "text-xs font-medium text-muted-foreground uppercase",
            children: folderMessages.title,
          }),
          _jsx(Button, {
            type: "button",
            variant: "ghost",
            size: "icon-sm",
            "aria-label": folderMessages.newFolder,
            onClick: () => setCreating((open) => !open),
            children: _jsx(FolderPlus, { className: "size-4", "aria-hidden": "true" }),
          }),
        ],
      }),
      creating
        ? _jsxs("div", {
            className: "flex flex-col gap-2 px-2 pb-2",
            children: [
              _jsx(Input, {
                value: name,
                autoFocus: true,
                placeholder: folderMessages.newFolderPlaceholder,
                "aria-label": folderMessages.newFolderPlaceholder,
                onChange: (event) => setName(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === "Enter") void submit()
                },
              }),
              _jsxs("div", {
                className: "flex gap-2",
                children: [
                  _jsx(Button, {
                    type: "button",
                    size: "sm",
                    className: "flex-1",
                    disabled: create.isPending || !name.trim(),
                    onClick: () => void submit(),
                    children: folderMessages.create,
                  }),
                  _jsx(Button, {
                    type: "button",
                    size: "sm",
                    variant: "ghost",
                    onClick: () => {
                      setCreating(false)
                      setName("")
                    },
                    children: messages.common.cancel,
                  }),
                ],
              }),
            ],
          })
        : null,
      _jsxs("button", {
        type: "button",
        onClick: () => onSelectFolder(undefined),
        className: cn(
          "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
          selectedFolderId === undefined && "bg-muted font-medium",
        ),
        children: [
          _jsx(Library, { className: "size-4 shrink-0", "aria-hidden": "true" }),
          _jsx("span", { className: "truncate", children: folderMessages.allAssets }),
        ],
      }),
      isPending
        ? _jsx("div", {
            className: "flex items-center justify-center py-4",
            children: _jsx(Loader2, {
              className: "size-4 animate-spin text-muted-foreground",
              "aria-hidden": "true",
            }),
          })
        : isError
          ? _jsx("p", {
              className: "px-2 py-2 text-xs text-destructive",
              children: folderMessages.loadingError,
            })
          : data && data.data.length > 0
            ? data.data.map((folder) =>
                _jsxs(
                  "div",
                  {
                    className: "group flex items-center gap-1",
                    children: [
                      _jsxs("button", {
                        type: "button",
                        onClick: () => onSelectFolder(folder.id),
                        className: cn(
                          "flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                          selectedFolderId === folder.id && "bg-muted font-medium",
                        ),
                        children: [
                          _jsx(Folder, { className: "size-4 shrink-0", "aria-hidden": "true" }),
                          _jsx("span", { className: "truncate", children: folder.name }),
                        ],
                      }),
                      _jsx(Button, {
                        type: "button",
                        variant: "ghost",
                        size: "icon-sm",
                        "aria-label": folderMessages.deleteFolder,
                        className: "opacity-0 transition group-hover:opacity-100",
                        onClick: () => {
                          if (
                            typeof window !== "undefined" &&
                            !window.confirm(folderMessages.deleteConfirm)
                          ) {
                            return
                          }
                          if (selectedFolderId === folder.id) onSelectFolder(undefined)
                          remove.mutate(folder.id)
                        },
                        children: _jsx(Trash2, { className: "size-3.5", "aria-hidden": "true" }),
                      }),
                    ],
                  },
                  folder.id,
                ),
              )
            : _jsx("p", {
                className: "px-2 py-2 text-xs text-muted-foreground",
                children: folderMessages.empty,
              }),
    ],
  })
}
