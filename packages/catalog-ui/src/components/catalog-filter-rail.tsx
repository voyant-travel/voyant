"use client"

import type { CatalogFacetBucket } from "@voyantjs/catalog-react"
import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import { Input } from "@voyantjs/ui/components/input"
import { Separator } from "@voyantjs/ui/components/separator"
import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type { CatalogRangeFilterValue } from "./catalog-range-filter.js"
import type {
  CatalogFacetFilterField,
  CatalogFilterField,
  CatalogRangeFilterField,
} from "./catalog-search-page.js"

/** How many facet values show before the "Show all" toggle. */
const DEFAULT_VISIBLE = 6

export interface CatalogFilterRailProps {
  /** Visible filter fields (facets with buckets/selection + all ranges). */
  fields: CatalogFilterField[]
  /** Live facet buckets keyed by field. */
  facetGroups: Record<string, CatalogFacetBucket[]>
  selectedFacets: Record<string, Array<string | number>>
  selectedRanges: Record<string, CatalogRangeFilterValue>
  onToggleFacet: (field: string, value: string | number) => void
  onClearFacet: (field: string) => void
  onSetRange: (field: string, value: CatalogRangeFilterValue | undefined) => void
  onClearAll: () => void
  hasSelections: boolean
}

/**
 * Persistent, sectioned left filter rail (Booking.com-style). Facets render
 * as inline checkbox lists with live counts; numeric ranges render as inline
 * min/max inputs. Replaces the wrapping chip row for a scannable, always-on
 * filtering surface. Selection state is owned by the parent
 * (`CatalogSearchPage`); this component is presentational.
 */
export function CatalogFilterRail({
  fields,
  facetGroups,
  selectedFacets,
  selectedRanges,
  onToggleFacet,
  onClearFacet,
  onSetRange,
  onClearAll,
  hasSelections,
}: CatalogFilterRailProps) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{messages.view.filters}</span>
        {hasSelections && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            {messages.search.clearAll}
          </Button>
        )}
      </div>
      {fields.map((field, index) => {
        const isRange = (field.kind ?? "facet") === "range"
        return (
          <div key={field.field} className="flex flex-col gap-2">
            {index > 0 && <Separator className="mb-1" />}
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {field.label}
              </span>
              {!isRange && (selectedFacets[field.field]?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => onClearFacet(field.field)}
                  className="text-muted-foreground text-xs hover:text-foreground"
                >
                  {messages.filtersUi.clear}
                </button>
              )}
            </div>
            {isRange ? (
              <RangeSection
                field={field as CatalogRangeFilterField}
                value={selectedRanges[field.field]}
                onChange={(next) => onSetRange(field.field, next)}
              />
            ) : (
              <FacetSection
                field={field as CatalogFacetFilterField}
                buckets={facetGroups[field.field] ?? []}
                selected={selectedFacets[field.field] ?? []}
                onToggle={(value) => onToggleFacet(field.field, value)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FacetSection({
  field,
  buckets,
  selected,
  onToggle,
}: {
  field: CatalogFacetFilterField
  buckets: CatalogFacetBucket[]
  selected: Array<string | number>
  onToggle: (value: string | number) => void
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage
  const [expanded, setExpanded] = useState(false)
  const selectedSet = new Set(selected)
  const display = (value: string | number) =>
    field.formatValue ? field.formatValue(value) : String(value)

  if (buckets.length === 0) {
    return <span className="text-muted-foreground text-xs">{messages.filtersUi.noResults}</span>
  }

  const ordered = sortBuckets(buckets, field.sortValues)
  const visible = expanded ? ordered : ordered.slice(0, DEFAULT_VISIBLE)

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((bucket) => {
        const checked = selectedSet.has(bucket.value)
        return (
          <button
            key={String(bucket.value)}
            type="button"
            onClick={() => onToggle(bucket.value)}
            className="flex w-full items-center gap-2 text-left text-sm"
          >
            <Checkbox checked={checked} aria-hidden tabIndex={-1} className="pointer-events-none" />
            <span className="flex-1 truncate capitalize">{display(bucket.value)}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{bucket.count}</span>
          </button>
        )
      })}
      {buckets.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="self-start text-primary text-xs hover:underline"
        >
          {expanded
            ? messages.view.showLess
            : messages.view.showAll.replace("{count}", String(buckets.length))}
        </button>
      )}
    </div>
  )
}

// Order facet buckets. Default keeps the index's count-descending order;
// "value-desc"/"value-asc" sort numerically when the values parse as numbers
// (star ratings 5 → 0), else lexicographically.
function sortBuckets(
  buckets: CatalogFacetBucket[],
  sort: CatalogFacetFilterField["sortValues"],
): CatalogFacetBucket[] {
  if (!sort || sort === "count") return buckets
  const dir = sort === "value-asc" ? 1 : -1
  return [...buckets].sort((a, b) => {
    const an = Number(a.value)
    const bn = Number(b.value)
    if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir
    return String(a.value).localeCompare(String(b.value)) * dir
  })
}

function RangeSection({
  field,
  value,
  onChange,
}: {
  field: CatalogRangeFilterField
  value: CatalogRangeFilterValue | undefined
  onChange: (next: CatalogRangeFilterValue | undefined) => void
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage.filtersUi
  const [minText, setMinText] = useState(value?.gte != null ? String(value.gte) : "")
  const [maxText, setMaxText] = useState(value?.lte != null ? String(value.lte) : "")

  useEffect(() => {
    setMinText(value?.gte != null ? String(value.gte) : "")
    setMaxText(value?.lte != null ? String(value.lte) : "")
  }, [value])

  const apply = () => {
    const gte = parseNumber(minText)
    const lte = parseNumber(maxText)
    if (gte == null && lte == null) {
      onChange(undefined)
      return
    }
    onChange({ gte: gte ?? undefined, lte: lte ?? undefined })
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="decimal"
        step={field.step}
        placeholder={field.minPlaceholder ?? messages.min}
        value={minText}
        onChange={(e) => setMinText(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply()
        }}
        className="h-8"
      />
      <span className="text-muted-foreground text-xs">{messages.to}</span>
      <Input
        type="number"
        inputMode="decimal"
        step={field.step}
        placeholder={field.maxPlaceholder ?? messages.max}
        value={maxText}
        onChange={(e) => setMaxText(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply()
        }}
        className="h-8"
      />
    </div>
  )
}

function parseNumber(s: string): number | null {
  if (!s.trim()) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
