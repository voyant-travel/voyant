"use client"
import { Button } from "@voyant-travel/ui/components/button"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@voyant-travel/ui/components/native-select"
import { Search, X } from "lucide-react"
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
import { MEDIA_ASSET_TYPES } from "./shared.js"
/** Filter controls for the library: search, type, tag, and format. */
export function MediaFiltersBar({ value, onChange, hideType, compact }) {
  const messages = useMediaUiMessagesOrDefault()
  const { filters, searchPlaceholder } = messages.library
  const { allTypes, mediaTypeLabels } = messages.common
  const patch = (next) => onChange({ ...value, ...next })
  const hasFilters = Boolean(value.name || value.type || value.tag || value.mimeType)
  return _jsxs("div", {
    className: "flex flex-wrap items-end gap-3",
    "data-slot": "media-filters-bar",
    children: [
      _jsxs("div", {
        className: "relative min-w-48 flex-1",
        children: [
          _jsx(Search, {
            className:
              "pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground",
            "aria-hidden": "true",
          }),
          _jsx(Input, {
            value: value.name ?? "",
            onChange: (event) => patch({ name: event.target.value || undefined }),
            placeholder: searchPlaceholder,
            "aria-label": messages.common.search,
            className: "pl-8",
          }),
        ],
      }),
      !hideType
        ? _jsxs("div", {
            className: "flex flex-col gap-1",
            children: [
              _jsx(Label, {
                className: "text-xs text-muted-foreground",
                children: filters.typeLabel,
              }),
              _jsxs(NativeSelect, {
                value: value.type ?? "",
                onChange: (event) => patch({ type: event.target.value || undefined }),
                "aria-label": filters.typeLabel,
                children: [
                  _jsx(NativeSelectOption, { value: "", children: allTypes }),
                  MEDIA_ASSET_TYPES.map((type) =>
                    _jsx(
                      NativeSelectOption,
                      { value: type, children: mediaTypeLabels[type] },
                      type,
                    ),
                  ),
                ],
              }),
            ],
          })
        : null,
      !compact
        ? _jsxs(_Fragment, {
            children: [
              _jsxs("div", {
                className: "flex flex-col gap-1",
                children: [
                  _jsx(Label, {
                    className: "text-xs text-muted-foreground",
                    children: filters.tagLabel,
                  }),
                  _jsx(Input, {
                    value: value.tag ?? "",
                    onChange: (event) => patch({ tag: event.target.value || undefined }),
                    placeholder: filters.tagPlaceholder,
                    "aria-label": filters.tagLabel,
                    className: "w-40",
                  }),
                ],
              }),
              _jsxs("div", {
                className: "flex flex-col gap-1",
                children: [
                  _jsx(Label, {
                    className: "text-xs text-muted-foreground",
                    children: filters.mimeLabel,
                  }),
                  _jsx(Input, {
                    value: value.mimeType ?? "",
                    onChange: (event) => patch({ mimeType: event.target.value || undefined }),
                    placeholder: filters.mimePlaceholder,
                    "aria-label": filters.mimeLabel,
                    className: "w-40",
                  }),
                ],
              }),
            ],
          })
        : null,
      hasFilters
        ? _jsxs(Button, {
            type: "button",
            variant: "ghost",
            size: "sm",
            onClick: () =>
              onChange({
                ...value,
                name: undefined,
                type: undefined,
                tag: undefined,
                mimeType: undefined,
              }),
            children: [
              _jsx(X, { className: "mr-1 size-3.5", "aria-hidden": "true" }),
              filters.clear,
            ],
          })
        : null,
    ],
  })
}
