"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Image as ImageIcon, Plane } from "lucide-react"

import type { CatalogUiMessages } from "../i18n/messages.js"

export interface SearchResultCard {
  productId: string
  name: string | null
  image: string | null
  stars: string | number | null
  destination: string | null
  country: string | null
  board: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  departureAirport: string | null
  arrivalAirport: string | null
  carrier: string | null
  perPerson: { amountMinor: number; currency: string } | null
  total: { amountMinor: number; currency: string } | null
}

export interface AirportOption {
  code: string
  label: string
}

type SearchMessages = CatalogUiMessages["catalogBrowser"]["search"]
type BoardLabels = CatalogUiMessages["catalogBrowser"]["detail"]["boards"]

// Loading state for a live availability search — mirrors the results layout
// (availability calendar + holiday cards) so there's no empty box or jump when
// offers arrive.
export function DynamicResultsSkeleton() {
  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Calendar */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-44 animate-pulse rounded bg-muted/30" />
        <div className="rounded-lg border p-3">
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="h-7 w-7 animate-pulse rounded bg-muted/30" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted/30" />
            <div className="h-7 w-7 animate-pulse rounded bg-muted/30" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
                key={i}
                className={`rounded-md ${i < 7 ? "h-3 bg-muted/15" : "aspect-square animate-pulse bg-muted/20"}`}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Holiday cards */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-56 animate-pulse rounded bg-muted/30" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
            <div key={i} className="flex flex-col overflow-hidden rounded-lg border">
              <div className="aspect-[4/3] w-full animate-pulse bg-muted/40" />
              <div className="flex flex-col gap-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted/20" />
                <div className="mt-2 h-5 w-1/3 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function HolidayCard({
  card,
  onOpen,
  s,
  boards,
  locale,
}: {
  card: SearchResultCard
  onOpen: (productId: string) => void
  s: SearchMessages
  boards: BoardLabels
  locale: string
}) {
  const open = () => onOpen(card.productId)
  const stars = formatStars(card.stars)
  const subtitle = [stars, card.destination, formatCountry(card.country, locale)]
    .filter((v): v is string => Boolean(v))
    .join(" · ")
  return (
    <button
      type="button"
      onClick={open}
      className="group flex flex-col overflow-hidden rounded-lg border text-left transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {card.image ? (
          <img
            src={card.image}
            alt={card.name ?? ""}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
        {card.nights != null && (
          <span className="absolute top-2 right-2 rounded-md bg-background/90 px-2 py-0.5 font-medium text-xs shadow-sm backdrop-blur">
            {card.nights}n
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate font-medium leading-tight">{card.name}</div>
          {subtitle && <div className="truncate text-muted-foreground text-sm">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {card.board && (
            <Badge variant="outline" className="font-normal">
              {(boards as Record<string, string>)[card.board.toUpperCase()] ?? card.board}
            </Badge>
          )}
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            <Plane className="h-3.5 w-3.5" />
            {card.departureAirport && card.arrivalAirport
              ? `${card.departureAirport} → ${card.arrivalAirport}${card.carrier ? ` · ${card.carrier}` : ""}`
              : s.flightIncluded}
          </span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {card.total && (
              <div className="font-semibold text-base">{formatMoney(card.total, locale)}</div>
            )}
            {card.perPerson && (
              <div className="text-muted-foreground text-xs">
                {formatMoney(card.perPerson, locale)} {s.perPerson}
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-md bg-secondary px-3 py-1.5 font-medium text-secondary-foreground text-sm">
            {s.viewDates}
          </span>
        </div>
      </div>
    </button>
  )
}

function formatMoney(m: { amountMinor: number; currency: string }, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: 0,
  }).format(m.amountMinor / 100)
}

function formatStars(value: string | number | null): string | null {
  const n = typeof value === "number" ? value : value ? Number(value) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return `${Number.isInteger(n) ? n : n.toFixed(1)}★`
}

function formatCountry(code: string | null, locale?: string): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return code
  try {
    return new Intl.DisplayNames(locale, { type: "region" }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
