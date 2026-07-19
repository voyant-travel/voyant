"use client"
import { Button } from "@voyant-travel/ui/components/button"
import { Dialog, DialogContent, DialogTrigger } from "@voyant-travel/ui/components/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "@voyant-travel/ui/components/empty"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import { cn } from "@voyant-travel/ui/lib/utils"
import * as React from "react"
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { useAssetUpload } from "../hooks/use-asset-upload.js"
import { useMediaAssets } from "../hooks/use-media-assets.js"
import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
import { useVoyantMediaContext } from "../provider.js"
import { MediaAssetTile } from "./media-asset-tile.js"
import { MediaFiltersBar } from "./media-filters-bar.js"
import { MediaUploadDropzone } from "./media-upload-dropzone.js"
import { ACCEPT_BY_TYPE, defaultAssetUrl, inferAssetType } from "./shared.js"
/**
 * Host-agnostic asset picker other surfaces embed. Supports single/multi
 * select, a locked or user-driven type filter, search, and inline upload that
 * lands in the library and auto-selects. Emits the chosen assets via
 * `onSelect`.
 */
export function MediaPicker({
  onSelect,
  multiple = false,
  type,
  inline = false,
  open,
  onOpenChange,
  trigger,
  resolveAssetUrl,
  pageSize = 40,
  className,
}) {
  const body = _jsx(MediaPickerBody, {
    onSelect: onSelect,
    multiple: multiple,
    type: type,
    resolveAssetUrl: resolveAssetUrl,
    pageSize: pageSize,
    onDone: () => onOpenChange?.(false),
    className: className,
  })
  if (inline) return body
  return _jsxs(Dialog, {
    open: open,
    onOpenChange: onOpenChange,
    children: [
      trigger ? _jsx(DialogTrigger, { render: trigger }) : null,
      _jsx(DialogContent, { className: "max-w-3xl", children: body }),
    ],
  })
}
function MediaPickerBody({
  onSelect,
  multiple,
  type,
  resolveAssetUrl,
  pageSize,
  onDone,
  className,
}) {
  const messages = useMediaUiMessagesOrDefault()
  const picker = messages.picker
  const { baseUrl } = useVoyantMediaContext()
  const [filters, setFilters] = React.useState({})
  const [selected, setSelected] = React.useState(new Map())
  const upload = useAssetUpload()
  const query = useMediaAssets({
    ...filters,
    type: type ?? filters.type,
    limit: pageSize,
  })
  const assets = query.data?.data ?? []
  const urlFor = (asset) => resolveAssetUrl?.(asset) ?? defaultAssetUrl(asset, baseUrl)
  const confirm = (chosen) => {
    if (chosen.length === 0) return
    onSelect(chosen)
    onDone()
  }
  const pick = (asset) => {
    if (!multiple) {
      confirm([asset])
      return
    }
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(asset.id)) next.delete(asset.id)
      else next.set(asset.id, asset)
      return next
    })
  }
  const handleFiles = async (files) => {
    const uploaded = []
    for (const file of files) {
      const result = await upload.mutateAsync({
        file,
        type: type ?? inferAssetType(file.type),
        name: file.name,
        mimeType: file.type || undefined,
      })
      uploaded.push(result.data)
    }
    if (uploaded.length === 0) return
    if (!multiple) {
      confirm([uploaded[uploaded.length - 1]])
      return
    }
    setSelected((prev) => {
      const next = new Map(prev)
      for (const asset of uploaded) next.set(asset.id, asset)
      return next
    })
  }
  return _jsxs("div", {
    className: cn("flex flex-col gap-4", className),
    "data-slot": "media-picker",
    children: [
      _jsx("h2", { className: "text-base font-semibold", children: picker.title }),
      _jsx(MediaFiltersBar, {
        value: filters,
        onChange: setFilters,
        hideType: Boolean(type),
        compact: true,
      }),
      _jsx(MediaUploadDropzone, {
        onFiles: (files) => void handleFiles(files),
        uploading: upload.isPending,
        accept: type ? ACCEPT_BY_TYPE[type] : undefined,
        multiple: multiple,
        compact: true,
      }),
      query.isPending
        ? _jsx("div", {
            className: "grid grid-cols-2 gap-3 sm:grid-cols-3",
            children: Array.from({ length: 6 }).map((_, index) =>
              _jsx(Skeleton, { className: "aspect-video rounded-md" }, index),
            ),
          })
        : query.isError
          ? _jsx("p", {
              className: "py-6 text-center text-sm text-destructive",
              children: picker.loadingError,
            })
          : assets.length === 0
            ? _jsx(Empty, {
                children: _jsx(EmptyHeader, {
                  children: _jsx(EmptyTitle, { children: picker.empty }),
                }),
              })
            : _jsx("div", {
                className: "grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3",
                children: assets.map((asset) =>
                  _jsx(
                    MediaAssetTile,
                    {
                      asset: asset,
                      url: urlFor(asset),
                      selectable: multiple,
                      selected: selected.has(asset.id),
                      onSelect: () => pick(asset),
                    },
                    asset.id,
                  ),
                ),
              }),
      multiple
        ? _jsxs("div", {
            className: "flex items-center justify-between gap-2 border-t pt-3",
            children: [
              _jsx("span", {
                className: "text-sm text-muted-foreground",
                children: picker.selectedCount.replace("{count}", String(selected.size)),
              }),
              _jsxs("div", {
                className: "flex gap-2",
                children: [
                  _jsx(Button, {
                    type: "button",
                    variant: "outline",
                    onClick: onDone,
                    children: picker.cancel,
                  }),
                  _jsx(Button, {
                    type: "button",
                    disabled: selected.size === 0,
                    onClick: () => confirm([...selected.values()]),
                    children: picker.confirm,
                  }),
                ],
              }),
            ],
          })
        : null,
    ],
  })
}
