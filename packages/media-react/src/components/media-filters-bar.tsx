"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@voyant-travel/ui/components/native-select"
import { Search, X } from "lucide-react"

import { useMediaUiMessagesOrDefault } from "../i18n/provider.js"
import type { MediaAssetsListFilters } from "../query-keys.js"
import type { MediaAssetType } from "../schemas.js"
import { MEDIA_ASSET_TYPES } from "./shared.js"

export interface MediaFiltersBarProps {
  value: MediaAssetsListFilters
  onChange: (next: MediaAssetsListFilters) => void
  /** Hide the type control (e.g. when the surface is locked to one type). */
  hideType?: boolean
  /** Hide the tag + format controls for a leaner bar (the picker). */
  compact?: boolean
}

/** Filter controls for the library: search, type, tag, and format. */
export function MediaFiltersBar({ value, onChange, hideType, compact }: MediaFiltersBarProps) {
  const messages = useMediaUiMessagesOrDefault()
  const { filters, searchPlaceholder } = messages.library
  const { allTypes, mediaTypeLabels } = messages.common

  const patch = (next: Partial<MediaAssetsListFilters>) => onChange({ ...value, ...next })
  const hasFilters = Boolean(value.name || value.type || value.tag || value.mimeType)

  return (
    <div className="flex flex-wrap items-end gap-3" data-slot="media-filters-bar">
      <div className="relative min-w-48 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={value.name ?? ""}
          onChange={(event) => patch({ name: event.target.value || undefined })}
          placeholder={searchPlaceholder}
          aria-label={messages.common.search}
          className="pl-8"
        />
      </div>

      {!hideType ? (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{filters.typeLabel}</Label>
          <NativeSelect
            value={value.type ?? ""}
            onChange={(event) =>
              patch({ type: (event.target.value || undefined) as MediaAssetType | undefined })
            }
            aria-label={filters.typeLabel}
          >
            <NativeSelectOption value="">{allTypes}</NativeSelectOption>
            {MEDIA_ASSET_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {mediaTypeLabels[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {!compact ? (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{filters.tagLabel}</Label>
            <Input
              value={value.tag ?? ""}
              onChange={(event) => patch({ tag: event.target.value || undefined })}
              placeholder={filters.tagPlaceholder}
              aria-label={filters.tagLabel}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{filters.mimeLabel}</Label>
            <Input
              value={value.mimeType ?? ""}
              onChange={(event) => patch({ mimeType: event.target.value || undefined })}
              placeholder={filters.mimePlaceholder}
              aria-label={filters.mimeLabel}
              className="w-40"
            />
          </div>
        </>
      ) : null}

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              ...value,
              name: undefined,
              type: undefined,
              tag: undefined,
              mimeType: undefined,
            })
          }
        >
          <X className="mr-1 size-3.5" aria-hidden="true" />
          {filters.clear}
        </Button>
      ) : null}
    </div>
  )
}
