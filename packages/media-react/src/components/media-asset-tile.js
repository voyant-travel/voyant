"use client"
import { Badge } from "@voyant-travel/ui/components/badge"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Check } from "lucide-react"
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
import { MediaAssetThumbnail } from "./media-asset-thumbnail.js"
/** A single asset card in the grid — the shared tile for the library and picker. */
export function MediaAssetTile({ asset, url, selected, onSelect, selectable }) {
  const messages = useMediaUiMessagesOrDefault()
  const typeLabel = messages.common.mediaTypeLabels[asset.type]
  return _jsxs("button", {
    type: "button",
    onClick: onSelect,
    "aria-pressed": selected,
    "data-slot": "media-asset-tile",
    className: cn(
      "group relative flex flex-col overflow-hidden rounded-md border bg-background text-left transition hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      selected && "border-primary ring-2 ring-primary",
    ),
    children: [
      _jsxs("div", {
        className: "relative aspect-video bg-muted",
        children: [
          _jsx(MediaAssetThumbnail, { asset: asset, url: url }),
          _jsx(Badge, {
            variant: "secondary",
            className: "absolute top-2 right-2 bg-background/90",
            children: typeLabel,
          }),
          selectable && selected
            ? _jsx("span", {
                className:
                  "absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                children: _jsx(Check, { className: "size-3", "aria-hidden": "true" }),
              })
            : null,
        ],
      }),
      _jsxs("div", {
        className: "min-w-0 space-y-0.5 p-2.5",
        children: [
          _jsx("div", { className: "truncate text-sm font-medium", children: asset.name }),
          asset.alt
            ? _jsx("div", {
                className: "truncate text-xs text-muted-foreground",
                children: asset.alt,
              })
            : null,
        ],
      }),
    ],
  })
}
