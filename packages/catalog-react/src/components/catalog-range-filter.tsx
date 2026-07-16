"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Input } from "@voyant-travel/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@voyant-travel/ui/components/popover"
import { Separator } from "@voyant-travel/ui/components/separator"
import { PlusCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useCatalogUiI18nOrDefault } from "../i18n/index.js"

export interface CatalogRangeFilterValue {
  gte?: number
  lte?: number
}

export interface CatalogRangeFilterProps {
  /** Field name (matches the indexer document field). */
  field: string
  /** Display label for the trigger. */
  label: string
  /** Current selection. `undefined` means no filter. */
  value: CatalogRangeFilterValue | undefined
  /** Apply a new range. */
  onChange: (next: CatalogRangeFilterValue | undefined) => void
  /** Number-input step (default 1). */
  step?: number
  /** Optional placeholder min/max — purely visual. */
  minPlaceholder?: string
  maxPlaceholder?: string
  /**
   * Format the active selection in the trigger badge. When the field
   * stores money in cents, use `format="currency"` + `currency` so the
   * trigger displays e.g. "€100 – €500".
   */
  format?: "number" | "currency"
  /** ISO 4217 currency code when `format === "currency"`. */
  currency?: string
}

/**
 * Numeric-range filter — popover trigger styled like the faceted filter
 * for visual consistency. When active, the trigger shows the range as a
 * compact badge ("≥ €100", "≤ €500", or "€100 – €500").
 */
export function CatalogRangeFilter({
  label,
  value,
  onChange,
  step = 1,
  minPlaceholder,
  maxPlaceholder,
  format = "number",
  currency,
}: CatalogRangeFilterProps) {
  const { locale, messages: rootMessages } = useCatalogUiI18nOrDefault()
  const messages = rootMessages.catalogPage.filtersUi
  const resolvedMinPlaceholder = minPlaceholder ?? messages.min
  const resolvedMaxPlaceholder = maxPlaceholder ?? messages.max
  // Track local string state so users can type freely without the parent
  // re-rendering between keystrokes.
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

  const clear = () => {
    setMinText("")
    setMaxText("")
    onChange(undefined)
  }

  const active = value?.gte != null || value?.lte != null
  const display = active ? formatRange(value, format, currency, locale) : null

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 border-dashed" />}>
        <PlusCircle className="mr-2 h-4 w-4" />
        {label}
        {active && display && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {display}
            </Badge>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              step={step}
              placeholder={resolvedMinPlaceholder}
              value={minText}
              onChange={(e) => setMinText(e.target.value)}
              className="h-8"
            />
            <span className="text-muted-foreground text-xs">{messages.to}</span>
            <Input
              type="number"
              inputMode="decimal"
              step={step}
              placeholder={resolvedMaxPlaceholder}
              value={maxText}
              onChange={(e) => setMaxText(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={!active && !minText && !maxText}
            >
              {messages.clear}
            </Button>
            <Button size="sm" onClick={apply}>
              {messages.apply}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function parseNumber(s: string): number | null {
  if (!s.trim()) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function formatRange(
  v: CatalogRangeFilterValue | undefined,
  format: "number" | "currency",
  currency: string | undefined,
  locale: string,
): string | null {
  if (!v) return null
  const fmt = (n: number) => {
    if (format === "currency" && currency) {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n)
    }
    return new Intl.NumberFormat(locale).format(n)
  }
  if (v.gte != null && v.lte != null) return `${fmt(v.gte)} – ${fmt(v.lte)}`
  if (v.gte != null) return `≥ ${fmt(v.gte)}`
  if (v.lte != null) return `≤ ${fmt(v.lte)}`
  return null
}
