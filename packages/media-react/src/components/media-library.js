"use client"
import { Button } from "@voyant-travel/ui/components/button"
import { Card, CardContent } from "@voyant-travel/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@voyant-travel/ui/components/empty"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import { cn } from "@voyant-travel/ui/lib/utils"
import { LayoutGrid, List } from "lucide-react"
import * as React from "react"
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { useAssetUpload } from "../hooks/use-asset-upload.js"
import { useMediaAssets } from "../hooks/use-media-assets.js"
import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
import { useVoyantMediaContext } from "../provider.js"
import { MediaAssetDetailPanel } from "./media-asset-detail-panel.js"
import { MediaAssetThumbnail } from "./media-asset-thumbnail.js"
import { MediaAssetTile } from "./media-asset-tile.js"
import { MediaFiltersBar } from "./media-filters-bar.js"
import { MediaFolderSidebar } from "./media-folder-sidebar.js"
import { MediaUploadDropzone } from "./media-upload-dropzone.js"
import { ACCEPT_BY_TYPE, defaultAssetUrl, inferAssetType } from "./shared.js"
/**
 * The full media-library browse surface: folder rail, filters, upload dropzone,
 * an asset grid/list, and a detail panel for the selected asset.
 */
export function MediaLibrary({ resolveAssetUrl, type, pageSize = 60, className }) {
  const messages = useMediaUiMessagesOrDefault()
  const library = messages.library
  const { baseUrl } = useVoyantMediaContext()
  const [filters, setFilters] = React.useState({})
  const [folderId, setFolderId] = React.useState()
  const [selectedId, setSelectedId] = React.useState()
  const [view, setView] = React.useState("grid")
  const upload = useAssetUpload()
  const query = useMediaAssets({
    ...filters,
    type: type ?? filters.type,
    folderId,
    limit: pageSize,
  })
  const assets = query.data?.data ?? []
  const selected = assets.find((asset) => asset.id === selectedId)
  const urlFor = React.useCallback(
    (asset) => resolveAssetUrl?.(asset) ?? defaultAssetUrl(asset, baseUrl),
    [resolveAssetUrl, baseUrl],
  )
  const handleFiles = (files) => {
    for (const file of files) {
      upload.mutate({
        file,
        type: type ?? inferAssetType(file.type),
        name: file.name,
        mimeType: file.type || undefined,
        folderIds: folderId ? [folderId] : undefined,
      })
    }
  }
  return _jsxs("div", {
    className: cn("flex flex-col gap-4", className),
    "data-slot": "media-library",
    children: [
      _jsxs("div", {
        className: "flex flex-col gap-1",
        children: [
          _jsx("h2", { className: "text-lg font-semibold", children: library.title }),
          _jsx("p", { className: "text-sm text-muted-foreground", children: library.description }),
        ],
      }),
      _jsxs("div", {
        className: "flex gap-4",
        children: [
          _jsx(MediaFolderSidebar, { selectedFolderId: folderId, onSelectFolder: setFolderId }),
          _jsxs("div", {
            className: "flex min-w-0 flex-1 flex-col gap-4",
            children: [
              _jsxs("div", {
                className: "flex flex-wrap items-end justify-between gap-3",
                children: [
                  _jsx(MediaFiltersBar, {
                    value: filters,
                    onChange: setFilters,
                    hideType: Boolean(type),
                  }),
                  _jsxs("div", {
                    className: "flex items-center gap-1",
                    children: [
                      _jsx(Button, {
                        type: "button",
                        variant: view === "grid" ? "secondary" : "ghost",
                        size: "icon-sm",
                        "aria-label": library.view.grid,
                        "aria-pressed": view === "grid",
                        onClick: () => setView("grid"),
                        children: _jsx(LayoutGrid, { className: "size-4", "aria-hidden": "true" }),
                      }),
                      _jsx(Button, {
                        type: "button",
                        variant: view === "list" ? "secondary" : "ghost",
                        size: "icon-sm",
                        "aria-label": library.view.list,
                        "aria-pressed": view === "list",
                        onClick: () => setView("list"),
                        children: _jsx(List, { className: "size-4", "aria-hidden": "true" }),
                      }),
                    ],
                  }),
                ],
              }),
              _jsx(MediaUploadDropzone, {
                onFiles: handleFiles,
                uploading: upload.isPending,
                accept: type ? ACCEPT_BY_TYPE[type] : undefined,
              }),
              query.isPending
                ? _jsx("div", {
                    className: "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
                    children: Array.from({ length: 8 }).map((_, index) =>
                      _jsx(Skeleton, { className: "aspect-video rounded-md" }, index),
                    ),
                  })
                : query.isError
                  ? _jsx(Card, {
                      children: _jsxs(CardContent, {
                        className: "flex flex-col items-center gap-3 py-8 text-center",
                        children: [
                          _jsx("p", {
                            className: "text-sm text-destructive",
                            children: library.loadingError,
                          }),
                          _jsx(Button, {
                            type: "button",
                            variant: "outline",
                            size: "sm",
                            onClick: () => void query.refetch(),
                            children: messages.common.retry,
                          }),
                        ],
                      }),
                    })
                  : assets.length === 0
                    ? _jsx(Empty, {
                        children: _jsxs(EmptyHeader, {
                          children: [
                            _jsx(EmptyTitle, { children: library.empty }),
                            _jsx(EmptyDescription, { children: library.upload.hint }),
                          ],
                        }),
                      })
                    : _jsxs("div", {
                        className: "flex flex-col gap-2",
                        children: [
                          _jsx("p", {
                            className: "text-xs text-muted-foreground",
                            children: library.itemCount.replace(
                              "{count}",
                              String(query.data?.total ?? assets.length),
                            ),
                          }),
                          view === "grid"
                            ? _jsx("div", {
                                className: "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
                                children: assets.map((asset) =>
                                  _jsx(
                                    MediaAssetTile,
                                    {
                                      asset: asset,
                                      url: urlFor(asset),
                                      selected: asset.id === selectedId,
                                      onSelect: () => setSelectedId(asset.id),
                                    },
                                    asset.id,
                                  ),
                                ),
                              })
                            : _jsx("ul", {
                                className: "flex flex-col divide-y rounded-md border",
                                children: assets.map((asset) =>
                                  _jsx(
                                    "li",
                                    {
                                      children: _jsxs("button", {
                                        type: "button",
                                        onClick: () => setSelectedId(asset.id),
                                        "aria-pressed": asset.id === selectedId,
                                        className: cn(
                                          "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted",
                                          asset.id === selectedId && "bg-muted",
                                        ),
                                        children: [
                                          _jsx("span", {
                                            className:
                                              "size-10 shrink-0 overflow-hidden rounded-sm border",
                                            children: _jsx(MediaAssetThumbnail, {
                                              asset: asset,
                                              url: urlFor(asset),
                                            }),
                                          }),
                                          _jsxs("span", {
                                            className: "min-w-0 flex-1",
                                            children: [
                                              _jsx("span", {
                                                className: "block truncate text-sm font-medium",
                                                children: asset.name,
                                              }),
                                              _jsx("span", {
                                                className:
                                                  "block truncate text-xs text-muted-foreground",
                                                children:
                                                  messages.common.mediaTypeLabels[asset.type],
                                              }),
                                            ],
                                          }),
                                        ],
                                      }),
                                    },
                                    asset.id,
                                  ),
                                ),
                              }),
                        ],
                      }),
            ],
          }),
          selected
            ? _jsx(MediaAssetDetailPanel, {
                asset: selected,
                currentFolderId: folderId,
                onDeleted: () => setSelectedId(undefined),
              })
            : _jsx("div", {
                className:
                  "hidden w-80 shrink-0 items-start justify-center pt-8 text-sm text-muted-foreground lg:flex",
                children: library.detail.selectPrompt,
              }),
        ],
      }),
    ],
  })
}
