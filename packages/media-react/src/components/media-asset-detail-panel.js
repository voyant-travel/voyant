"use client"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@voyant-travel/ui/components/native-select"
import { Separator } from "@voyant-travel/ui/components/separator"
import { Textarea } from "@voyant-travel/ui/components/textarea"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import * as React from "react"
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { isAssetInUseError } from "../client.js"
import { useAssetUsage } from "../hooks/use-asset-usage.js"
import { useDeleteAsset } from "../hooks/use-delete-asset.js"
import { useFolderMutation } from "../hooks/use-folder-mutation.js"
import { useFolders } from "../hooks/use-folders.js"
import { useUpdateAsset } from "../hooks/use-update-asset.js"
import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
import { formatFileSize } from "./shared.js"
/** Detail + edit surface: rename, alt, tags, folder membership, and "where used". */
export function MediaAssetDetailPanel({ asset, currentFolderId, onDeleted }) {
  const messages = useMediaUiMessagesOrDefault()
  const detail = messages.library.detail
  const update = useUpdateAsset()
  const remove = useDeleteAsset()
  const folderMutation = useFolderMutation()
  const { data: folderData } = useFolders({ limit: 200 })
  const usage = useAssetUsage(asset.id)
  const [name, setName] = React.useState(asset.name)
  const [alt, setAlt] = React.useState(asset.alt ?? "")
  const [tagsInput, setTagsInput] = React.useState(asset.tags.join(", "))
  const [status, setStatus] = React.useState("idle")
  const [errorText, setErrorText] = React.useState(null)
  const [inUse, setInUse] = React.useState(false)
  const [addFolderId, setAddFolderId] = React.useState("")
  // Reset the form whenever a different asset is selected.
  React.useEffect(() => {
    setName(asset.name)
    setAlt(asset.alt ?? "")
    setTagsInput(asset.tags.join(", "))
    setStatus("idle")
    setErrorText(null)
    setInUse(false)
    setAddFolderId("")
  }, [asset])
  const save = async () => {
    setErrorText(null)
    try {
      await update.mutateAsync({
        assetId: asset.id,
        input: {
          name: name.trim() || asset.name,
          alt: alt.trim() ? alt.trim() : null,
          tags: tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
      })
      setStatus("saved")
    } catch {
      setStatus("idle")
      setErrorText(detail.saveFailed)
    }
  }
  const del = async () => {
    setErrorText(null)
    setInUse(false)
    try {
      await remove.mutateAsync(asset.id)
      onDeleted?.(asset)
    } catch (error) {
      if (isAssetInUseError(error)) {
        setInUse(true)
      } else {
        setErrorText(detail.deleteFailed)
      }
    }
  }
  const dimensions =
    asset.width && asset.height
      ? detail.dimensions
          .replace("{width}", String(asset.width))
          .replace("{height}", String(asset.height))
      : null
  const size = formatFileSize(asset.fileSize)
  const usageRecords = usage.data?.data ?? []
  return _jsxs("div", {
    className: "flex w-80 shrink-0 flex-col gap-4 overflow-y-auto",
    "data-slot": "media-asset-detail",
    children: [
      _jsx("div", {
        children: _jsx("h3", { className: "text-sm font-semibold", children: detail.title }),
      }),
      _jsxs("div", {
        className: "flex flex-col gap-1.5",
        children: [
          _jsx(Label, { htmlFor: "media-asset-name", children: detail.nameLabel }),
          _jsx(Input, {
            id: "media-asset-name",
            value: name,
            placeholder: detail.namePlaceholder,
            onChange: (event) => setName(event.target.value),
          }),
        ],
      }),
      _jsxs("div", {
        className: "flex flex-col gap-1.5",
        children: [
          _jsx(Label, { htmlFor: "media-asset-alt", children: detail.altLabel }),
          _jsx(Textarea, {
            id: "media-asset-alt",
            value: alt,
            rows: 2,
            placeholder: detail.altPlaceholder,
            onChange: (event) => setAlt(event.target.value),
          }),
        ],
      }),
      _jsxs("div", {
        className: "flex flex-col gap-1.5",
        children: [
          _jsx(Label, { htmlFor: "media-asset-tags", children: detail.tagsLabel }),
          _jsx(Input, {
            id: "media-asset-tags",
            value: tagsInput,
            placeholder: detail.tagsPlaceholder,
            onChange: (event) => setTagsInput(event.target.value),
          }),
          _jsx("p", { className: "text-xs text-muted-foreground", children: detail.tagsHint }),
        ],
      }),
      _jsxs("div", {
        className: "flex items-center gap-2",
        children: [
          _jsxs(Button, {
            type: "button",
            size: "sm",
            disabled: update.isPending,
            onClick: () => void save(),
            children: [
              update.isPending
                ? _jsx(Loader2, {
                    className: "mr-1.5 size-3.5 animate-spin",
                    "aria-hidden": "true",
                  })
                : null,
              update.isPending ? messages.common.saving : messages.common.save,
            ],
          }),
          status === "saved"
            ? _jsx("span", { className: "text-xs text-muted-foreground", children: detail.saved })
            : null,
          errorText
            ? _jsx("span", { className: "text-xs text-destructive", children: errorText })
            : null,
        ],
      }),
      _jsx(Separator, {}),
      _jsxs("div", {
        className: "flex flex-col gap-2",
        children: [
          _jsx(Label, { children: detail.foldersLabel }),
          _jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              _jsxs(NativeSelect, {
                value: addFolderId,
                className: "flex-1",
                "aria-label": detail.foldersLabel,
                onChange: (event) => setAddFolderId(event.target.value),
                children: [
                  _jsx(NativeSelectOption, { value: "", children: messages.library.folders.title }),
                  (folderData?.data ?? []).map((folder) =>
                    _jsx(
                      NativeSelectOption,
                      { value: folder.id, children: folder.name },
                      folder.id,
                    ),
                  ),
                ],
              }),
              _jsx(Button, {
                type: "button",
                size: "sm",
                variant: "outline",
                disabled: !addFolderId || folderMutation.addMember.isPending,
                onClick: () => {
                  if (!addFolderId) return
                  folderMutation.addMember.mutate({ folderId: addFolderId, assetId: asset.id })
                  setAddFolderId("")
                },
                children: detail.addToFolder,
              }),
            ],
          }),
          currentFolderId
            ? _jsx(Button, {
                type: "button",
                size: "sm",
                variant: "ghost",
                className: "justify-start",
                disabled: folderMutation.removeMember.isPending,
                onClick: () =>
                  folderMutation.removeMember.mutate({
                    folderId: currentFolderId,
                    assetId: asset.id,
                  }),
                children: messages.common.remove,
              })
            : _jsx("p", { className: "text-xs text-muted-foreground", children: detail.noFolders }),
        ],
      }),
      _jsx(Separator, {}),
      _jsxs("div", {
        className: "flex flex-col gap-1.5",
        children: [
          _jsx(Label, { children: detail.metadata }),
          _jsxs("dl", {
            className: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground",
            children: [
              _jsx("dt", { children: detail.typeField }),
              _jsx("dd", { children: messages.common.mediaTypeLabels[asset.type] }),
              dimensions
                ? _jsxs(_Fragment, {
                    children: [
                      _jsx("dt", { children: detail.dimensionsLabel }),
                      _jsx("dd", { children: dimensions }),
                    ],
                  })
                : null,
              size
                ? _jsxs(_Fragment, {
                    children: [
                      _jsx("dt", { children: detail.fileSizeLabel }),
                      _jsx("dd", { children: size }),
                    ],
                  })
                : null,
              asset.createdBy
                ? _jsxs(_Fragment, {
                    children: [
                      _jsx("dt", { children: detail.uploadedByLabel }),
                      _jsx("dd", { className: "truncate", children: asset.createdBy }),
                    ],
                  })
                : null,
            ],
          }),
        ],
      }),
      _jsx(Separator, {}),
      _jsxs("div", {
        className: "flex flex-col gap-2",
        children: [
          _jsx(Label, { children: detail.whereUsed }),
          usage.isPending
            ? _jsx(Loader2, {
                className: "size-4 animate-spin text-muted-foreground",
                "aria-hidden": "true",
              })
            : usageRecords.length === 0
              ? _jsx("p", {
                  className: "text-xs text-muted-foreground",
                  children: detail.whereUsedEmpty,
                })
              : _jsxs("div", {
                  className: "flex flex-col gap-1.5",
                  children: [
                    _jsx("p", {
                      className: "text-xs text-muted-foreground",
                      children: detail.usageCount.replace(
                        "{count}",
                        String(usage.data?.total ?? usageRecords.length),
                      ),
                    }),
                    _jsx("ul", {
                      className: "flex flex-col gap-1",
                      children: usageRecords.map((record) =>
                        _jsxs(
                          "li",
                          {
                            className: "flex items-center gap-2 text-xs",
                            children: [
                              _jsx(Badge, { variant: "outline", children: record.entityType }),
                              _jsx("span", {
                                className: "truncate text-muted-foreground",
                                children: record.entityId,
                              }),
                            ],
                          },
                          record.id,
                        ),
                      ),
                    }),
                  ],
                }),
        ],
      }),
      _jsx(Separator, {}),
      inUse
        ? _jsxs("div", {
            className: "flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3",
            children: [
              _jsx(AlertTriangle, {
                className: "size-4 shrink-0 text-destructive",
                "aria-hidden": "true",
              }),
              _jsxs("div", {
                className: "space-y-0.5",
                children: [
                  _jsx("p", {
                    className: "text-xs font-medium text-destructive",
                    children: detail.inUseTitle,
                  }),
                  _jsx("p", {
                    className: "text-xs text-muted-foreground",
                    children: detail.inUseWarning,
                  }),
                ],
              }),
            ],
          })
        : null,
      _jsxs(Button, {
        type: "button",
        variant: "destructive",
        size: "sm",
        disabled: remove.isPending,
        onClick: () => {
          if (typeof window !== "undefined" && !window.confirm(detail.deleteConfirm)) return
          void del()
        },
        children: [
          remove.isPending
            ? _jsx(Loader2, { className: "mr-1.5 size-3.5 animate-spin", "aria-hidden": "true" })
            : _jsx(Trash2, { className: "mr-1.5 size-3.5", "aria-hidden": "true" }),
          messages.common.delete,
        ],
      }),
    ],
  })
}
