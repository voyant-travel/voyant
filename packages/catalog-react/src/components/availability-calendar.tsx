"use client"

import { Button } from "@voyantjs/ui/components/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo } from "react"

import { useCatalogUiI18nOrDefault, useCatalogUiMessagesOrDefault } from "../i18n/index.js"

/**
 * Availability-aware month calendar. Each day that has live offers is
 * selectable and shows a "from" price plus how many offers/holidays depart
 * that day; days with no inventory are dimmed and disabled — so the operator
 * only ever picks a date that actually has something to sell.
 *
 * Shared by the Dynamic destination search (count = hotels available that day)
 * and the individual product page (count = room/board offers that day).
 */

export interface DayAvailability {
  count: number
  fromMinor: number
}

export interface MonthCursor {
  year: number
  month: number
}

export function AvailabilityCalendar({
  cursor,
  byDate,
  currency,
  selected,
  onSelect,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
}: {
  cursor: MonthCursor
  byDate: Map<string, DayAvailability>
  currency: string
  selected: string | null
  onSelect: (date: string) => void
  onPrev: () => void
  onNext: () => void
  canPrev?: boolean
  canNext?: boolean
}) {
  const cal = useCatalogUiMessagesOrDefault().catalogBrowser.calendar
  const { locale: resolvedLocale } = useCatalogUiI18nOrDefault()
  const { year, month } = cursor
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = new Intl.DateTimeFormat(resolvedLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1))

  // Localized short weekday names (Mon→Sun), derived from the app locale so we
  // never hard-code English. 2024-01-01 is a Monday.
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(resolvedLocale, { weekday: "short" })
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))))
  }, [resolvedLocale])

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label={cal.prevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[10rem] text-center font-medium text-sm capitalize">
          {monthLabel}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!canNext}
          aria-label={cal.nextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w) => (
          <div key={w} className="py-1 text-muted-foreground text-xs">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day == null) {
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed leading blanks -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
            return <div key={`blank-${i}`} />
          }
          const key = dateKey(year, month, day)
          const avail = byDate.get(key)
          const isSelected = selected === key
          if (!avail) {
            return (
              <div
                key={key}
                className="rounded-md border border-transparent py-2.5 text-muted-foreground/30 text-sm"
              >
                {day}
              </div>
            )
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`flex flex-col items-center gap-0.5 rounded-md border py-1.5 transition hover:border-primary ${
                isSelected ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <span className="font-medium text-sm leading-none">{day}</span>
              {Number.isFinite(avail.fromMinor) && avail.fromMinor > 0 && (
                <span className="font-semibold text-[11px] text-primary leading-none">
                  {formatCompact(avail.fromMinor, currency, resolvedLocale)}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground leading-none">
                {avail.count} {avail.count === 1 ? cal.offer : cal.offers}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatCompact(amountMinor: number, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(amountMinor / 100)
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function shiftMonth(c: MonthCursor, delta: number): MonthCursor {
  const d = new Date(c.year, c.month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function monthOfIso(iso: string): MonthCursor | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function compareMonth(a: MonthCursor, b: MonthCursor): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month
}
