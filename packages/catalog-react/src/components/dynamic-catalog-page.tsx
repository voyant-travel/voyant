"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { Input } from "@voyant-travel/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { Search, X } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { useCatalogUiI18nOrDefault, useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type { CatalogSearchParams, CatalogSurface } from "../index.js"
import {
  fetchDepartureAirports,
  fetchPackageSearch,
  useCatalogSearch,
  useVoyantCatalogContext,
} from "../index.js"
import {
  AvailabilityCalendar,
  compareMonth,
  type DayAvailability,
  type MonthCursor,
  monthOfIso,
  shiftMonth,
} from "./availability-calendar.js"
import {
  type AirportOption,
  DynamicResultsSkeleton,
  HolidayCard,
  type SearchResultCard,
} from "./dynamic-catalog-page-parts.js"

/**
 * Dynamic (FIT) catalog surface — search-first, availability-driven.
 *
 * Flow: free-text + destination + duration → a live `packages/search` across
 * that destination's dynamic hotels → an **availability calendar** (only days
 * with real offers are selectable, each showing a "from" price + how many
 * holidays depart that day) → pick a day → the holidays for that day. With no
 * search active it falls back to the indexed browse grid (`renderBrowseGrid`).
 *
 * Presentational: the data comes from `VoyantCatalogProvider` + the catalog
 * offer hooks/client; navigation (`buildDetailHref`), the embedded browse grid
 * (`renderBrowseGrid`) and the localized header (`productsLabel`/Tagline) are
 * injected by the host.
 *
 * See docs/architecture/catalog-supply-models.md (`dynamic` mechanic).
 */

const ALL_AIRPORTS = "__all__"
const ANY_MONTH = "__any__"

// Search-bar select triggers, sized to match the h-9 inputs. The trigger's
// height comes from a `data-[size]` variant that out-specifies a plain `h-9`,
// so we set it through the same variant; `rounded-md` matches the inputs.
const TRIGGER_CLASS = "h-9 rounded-md data-[size=default]:h-9"

// How far ahead to scan for departures (the calendar spans this window).
const SEARCH_LEAD_DAYS = 10
const SEARCH_WINDOW_DAYS = 230

export interface DynamicCatalogPageProps {
  search: CatalogSearchParams
  onSearchChange: (
    updater: (prev: CatalogSearchParams) => CatalogSearchParams,
    replace?: boolean,
  ) => void
  /** `/v1/admin/...` (default) vs `/v1/public/...`. */
  surface?: CatalogSurface
  /** Localized "Packages" header title. */
  productsLabel: string
  /** Localized header tagline. */
  productsTagline: string
  /** Build the detail-page href for a holiday (opened in a new tab). */
  buildDetailHref: (productId: string, ctx: { adults: number; nights: number }) => string
  /** Render the indexed browse grid shown when no live search is active. */
  renderBrowseGrid: (locks: { lockedFacets: Record<string, Array<string | number>> }) => ReactNode
}

type SearchState =
  | { status: "browse" }
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "results"
      offers: SearchResultCard[]
      currency: string
      retryable: boolean
    }

export function DynamicCatalogPage({
  search,
  onSearchChange,
  surface = "admin",
  productsLabel,
  productsTagline,
  buildDetailHref,
  renderBrowseGrid,
}: DynamicCatalogPageProps) {
  const { baseUrl, fetcher } = useVoyantCatalogContext()
  const browser = useCatalogUiMessagesOrDefault().catalogBrowser
  const s = browser.search
  const boards = browser.detail.boards
  const { locale: resolvedLocale } = useCatalogUiI18nOrDefault()
  const [destination, setDestination] = useState<string | null>(null)
  const [nights, setNights] = useState("7")
  const [adults, setAdults] = useState(2)
  const [month, setMonth] = useState(ANY_MONTH)
  const [airport, setAirport] = useState(ALL_AIRPORTS)
  const [airportOptions, setAirportOptions] = useState<AirportOption[]>([])
  const [airportsLoading, setAirportsLoading] = useState(false)

  // Destination picker, derived from the indexed country facet.
  const countriesQuery = useCatalogSearch({
    vertical: "products",
    facets: [{ field: "countryCodes" }],
    pagination: { limit: 1 },
    surface,
  })
  const countries = useMemo(() => {
    const region = new Intl.DisplayNames(resolvedLocale, { type: "region" })
    return (countriesQuery.data?.facets?.countryCodes ?? [])
      .map((b) => String(b.value))
      .filter((code) => /^[A-Za-z]{2}$/.test(code))
      .map((code) => ({ value: code, label: region.of(code.toUpperCase()) ?? code }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [countriesQuery.data, resolvedLocale])

  // "When" options: any time, then the next 8 departure months.
  const monthOptions = useMemo(() => {
    const opts = [{ value: ANY_MONTH, label: s.anyTime }]
    const now = new Date()
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat(resolvedLocale, { month: "short", year: "numeric" }).format(
          d,
        ),
      })
    }
    return opts
  }, [s.anyTime, resolvedLocale])

  // Length-of-stay options ("7 nights" / "10 nights" / "14 nights").
  const durations = useMemo(
    () => [7, 10, 14].map((n) => ({ value: String(n), label: `${n} ${s.nights}` })),
    [s.nights],
  )
  const [state, setState] = useState<SearchState>({ status: "browse" })
  const [monthCursor, setMonthCursor] = useState<MonthCursor | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const query = (search.q ?? "").trim().toLowerCase()

  // When the destination changes, probe its departure airports so the operator
  // can pick where they fly from BEFORE running the full availability search.
  useEffect(() => {
    if (!destination) {
      setAirportOptions([])
      setAirport(ALL_AIRPORTS)
      setAirportsLoading(false)
      return
    }
    let cancelled = false
    setAirport(ALL_AIRPORTS)
    setAirportOptions([])
    setAirportsLoading(true)
    void (async () => {
      try {
        const json = await fetchDepartureAirports(
          { baseUrl, fetcher, surface },
          { countryCode: destination },
        )
        if (!cancelled) setAirportOptions(json.departureAirports ?? [])
      } catch {
        if (!cancelled) setAirportOptions([])
      } finally {
        if (!cancelled) setAirportsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [destination, baseUrl, fetcher, surface])

  const runSearch = useCallback(async () => {
    if (!destination) return
    setState({ status: "loading" })
    setSelected(null)
    setMonthCursor(null)
    const n = Number(nights) || 7
    const { from, to } = searchWindow(month)
    try {
      const json = await fetchPackageSearch(
        { baseUrl, fetcher, surface },
        {
          countryCode: destination,
          departureDateFrom: from,
          departureDateTo: to,
          adults,
          nights: { min: n, max: n },
        },
      )
      const offers = json.offers ?? []
      // Refresh the picker from the full search (authoritative over the probe).
      if (json.departureAirports && json.departureAirports.length > 0) {
        setAirportOptions(json.departureAirports)
      }
      setState({
        status: "results",
        offers,
        currency: json.currency ?? "EUR",
        retryable: Boolean(json.retryable),
      })
    } catch {
      setState({ status: "error" })
    }
  }, [destination, nights, adults, month, baseUrl, fetcher, surface])

  const clearSearch = () => {
    setState({ status: "browse" })
    setSelected(null)
    setMonthCursor(null)
    setAirport(ALL_AIRPORTS)
  }

  // Offers filtered by the free-text box (hotel/destination) + departure airport.
  const offers = useMemo(() => {
    if (state.status !== "results") return []
    return state.offers.filter((o) => {
      if (airport !== ALL_AIRPORTS && o.departureAirport !== airport) return false
      if (query && !`${o.name ?? ""} ${o.destination ?? ""}`.toLowerCase().includes(query)) {
        return false
      }
      return true
    })
  }, [state, query, airport])

  // Per-day availability: how many holidays depart each day + the cheapest.
  const byDate = useMemo(() => {
    const map = new Map<string, { hotels: Set<string>; fromMinor: number }>()
    for (const o of offers) {
      if (!o.checkIn || !o.total) continue
      const day = o.checkIn.slice(0, 10)
      const cur = map.get(day) ?? { hotels: new Set<string>(), fromMinor: Number.POSITIVE_INFINITY }
      cur.hotels.add(o.productId)
      cur.fromMinor = Math.min(cur.fromMinor, o.total.amountMinor)
      map.set(day, cur)
    }
    const out = new Map<string, DayAvailability>()
    for (const [day, v] of map) out.set(day, { count: v.hotels.size, fromMinor: v.fromMinor })
    return out
  }, [offers])

  const availableMonths = useMemo(() => {
    const months = [...byDate.keys()].map(monthOfIso).filter((m): m is MonthCursor => m != null)
    months.sort(compareMonth)
    // Dedupe consecutive equal months.
    return months.filter((m, i) => i === 0 || compareMonth(m, months[i - 1] as MonthCursor) !== 0)
  }, [byDate])

  // Land the calendar on the first month that has departures + auto-select the
  // earliest available day so the operator sees holidays immediately.
  useEffect(() => {
    if (state.status !== "results") return
    const days = [...byDate.keys()].sort()
    if (days.length === 0) {
      setMonthCursor(null)
      setSelected(null)
      return
    }
    const first = days[0] as string
    setMonthCursor(monthOfIso(first))
    setSelected((prev) => (prev && byDate.has(prev) ? prev : first))
  }, [state.status, byDate])

  // i18n-literal-ok: "results" is a status discriminant and "EUR" a currency-code fallback, not UI copy.
  const currency = state.status === "results" ? state.currency : "EUR"

  const selectedOffers = useMemo(() => {
    if (!selected) return []
    const byHotel = new Map<string, SearchResultCard>()
    for (const o of offers) {
      if (o.checkIn?.slice(0, 10) !== selected) continue
      const cur = byHotel.get(o.productId)
      if (!cur || (o.total?.amountMinor ?? 0) < (cur.total?.amountMinor ?? 0)) {
        byHotel.set(o.productId, o)
      }
    }
    return [...byHotel.values()].sort(
      (a, b) => (a.total?.amountMinor ?? 0) - (b.total?.amountMinor ?? 0),
    )
  }, [offers, selected])

  const destinationLabel = useMemo(
    () => countries.find((c) => c.value === destination)?.label,
    [countries, destination],
  )

  // Open the full detail page in a new tab — the live search stays put in this
  // tab so the operator keeps their availability results. Occupancy + length of
  // stay ride along so the detail page's offers match the search.
  const openHoliday = (productId: string) => {
    const href = buildDetailHref(productId, { adults, nights: Number(nights) || 7 })
    if (typeof window !== "undefined") window.open(href, "_blank", "noopener,noreferrer")
  }

  const monthIndex = monthCursor
    ? availableMonths.findIndex((m) => compareMonth(m, monthCursor) === 0)
    : -1

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      {/* Page header — on top, surface-specific copy. */}
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{productsLabel}</h1>
        <p className="text-muted-foreground text-sm">{productsTagline}</p>
      </div>
      {/* Search bar — drives the page. */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-muted-foreground text-xs">{s.searchLabel}</span>
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search.q ?? ""}
              onChange={(e) =>
                onSearchChange(
                  (prev) => ({ ...prev, q: e.target.value || undefined, page: 1 }),
                  true,
                )
              }
              placeholder={s.searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{s.destination}</span>
          <Select
            items={countries}
            value={destination ?? undefined}
            onValueChange={(value) => setDestination(value as string)}
          >
            <SelectTrigger className={`${TRIGGER_CLASS} w-[190px]`} aria-label={s.destination}>
              <SelectValue placeholder={s.chooseCountry} />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{s.when}</span>
          <Select items={monthOptions} value={month} onValueChange={(v) => setMonth(v as string)}>
            <SelectTrigger className={`${TRIGGER_CLASS} w-[140px]`} aria-label={s.when}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {s.flyingFrom}
            {airportsLoading ? ` · ${s.finding}` : ""}
          </span>
          <Select
            value={airport}
            onValueChange={(v) => setAirport((v as string) || ALL_AIRPORTS)}
            disabled={airportOptions.length === 0}
          >
            <SelectTrigger className={`${TRIGGER_CLASS} w-[180px]`} aria-label={s.departureAirport}>
              <SelectValue placeholder={destination ? s.loading : s.allAirports} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AIRPORTS}>{s.allAirports}</SelectItem>
              {airportOptions.map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{s.duration}</span>
          <Select items={durations} value={nights} onValueChange={(v) => setNights(v as string)}>
            <SelectTrigger className={`${TRIGGER_CLASS} w-[120px]`} aria-label={s.duration}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durations.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{s.adults}</span>
          <Input
            type="number"
            aria-label={s.adults}
            min={1}
            value={adults}
            onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
            className="h-9 w-[80px]"
          />
        </div>
        <Button
          onClick={() => void runSearch()}
          disabled={!destination || state.status === "loading"}
          className="h-9"
        >
          <Search className="mr-1 h-4 w-4" />
          {state.status === "loading" ? s.searching : s.searchAvailability}
        </Button>
        {state.status !== "browse" && (
          <Button variant="ghost" onClick={clearSearch} className="h-9">
            <X className="mr-1 h-4 w-4" /> {s.clear}
          </Button>
        )}
      </div>

      {state.status === "browse" ? (
        <div className="mt-4">
          {renderBrowseGrid({ lockedFacets: { supplyModel: ["dynamic"] } })}
        </div>
      ) : state.status === "loading" ? (
        <DynamicResultsSkeleton />
      ) : state.status === "error" ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center text-destructive text-sm">
          {s.error}
        </div>
      ) : byDate.size === 0 ? (
        <div className="mt-4 rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
          {state.retryable
            ? s.availabilityUnavailable
            : s.noDepartures
                .replace("{nights}", nights)
                .replace("{destination}", destinationLabel ?? s.thisDestination)}
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          {/* Availability calendar */}
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-sm">
              {byDate.size} {byDate.size === 1 ? s.departureDate : s.departureDates}
              {destinationLabel ? ` ${s.in} ${destinationLabel}` : ""}
            </div>
            {monthCursor && (
              <AvailabilityCalendar
                cursor={monthCursor}
                byDate={byDate}
                currency={currency}
                selected={selected}
                onSelect={setSelected}
                onPrev={() => setMonthCursor((c) => (c ? shiftMonth(c, -1) : c))}
                onNext={() => setMonthCursor((c) => (c ? shiftMonth(c, 1) : c))}
                canPrev={monthIndex > 0}
                canNext={monthIndex >= 0 && monthIndex < availableMonths.length - 1}
              />
            )}
          </div>

          {/* Holidays for the selected day */}
          <div className="flex flex-col gap-3">
            {selected && (
              <div className="font-medium text-lg">
                {selectedOffers.length} {selectedOffers.length === 1 ? s.holiday : s.holidays}{" "}
                {s.departing} {formatDay(selected, resolvedLocale)}
              </div>
            )}
            {selectedOffers.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
                {s.selectDay}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {selectedOffers.map((card) => (
                  <HolidayCard
                    key={card.productId}
                    card={card}
                    onOpen={openHoliday}
                    s={s}
                    boards={boards}
                    locale={resolvedLocale}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
function formatDay(iso: string, locale?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// Translate the "When" selection into a departure-date window. "Any time" scans
// the next several months; a specific month clamps to that month (never earlier
// than the booking lead time).
function searchWindow(month: string): { from: string; to: string } {
  const lead = addDays(new Date(), SEARCH_LEAD_DAYS)
  if (month === ANY_MONTH) {
    return { from: isoDate(lead), to: isoDate(addDays(new Date(), SEARCH_WINDOW_DAYS)) }
  }
  const [year, m] = month.split("-").map(Number)
  const start = new Date(year as number, (m as number) - 1, 1)
  const end = new Date(year as number, m as number, 0)
  return { from: isoDate(start > lead ? start : lead), to: isoDate(end) }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
