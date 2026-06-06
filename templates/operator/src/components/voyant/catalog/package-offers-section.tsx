"use client"

import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Plane } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { getApiUrl } from "@/lib/env"

/** Lean offer shape returned by POST /v1/admin/catalog/package-offers. */
interface PackageOffer {
  id: string
  title: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  board: string | null
  roomTypeId: string | null
  ratePlanId: string | null
  perPerson: { amountMinor: number; currency: string } | null
  total: { amountMinor: number; currency: string } | null
  flights: Array<{
    origin: string | null
    destination: string | null
    departureAt: string | null
    carrier: string | null
    flightNumber: string | null
  }>
  freeCancellationUntil: string | null
  expiresAt: string | null
}

const BOARD_LABELS: Record<string, string> = {
  RO: "Room only",
  BB: "Bed & breakfast",
  HB: "Half board",
  FB: "Full board",
  AI: "All-inclusive",
}

export interface PackageOffersSectionProps {
  hit: CatalogSearchHit
  /** Book a specific live offer (lock/book by offer id). */
  onBookOffer?: (hit: CatalogSearchHit, offer: PackageOffer) => void
}

/**
 * Live package departures for a sourced product. Calls `packages/search` at
 * open time (sourced packages have no static departures/options/prices) and
 * renders the offers grouped by departure date — each with its board/room,
 * flights and per-person/total price. The search is live, so it can be empty
 * or temporarily unavailable.
 */
export function PackageOffersSection({ hit, onBookOffer }: PackageOffersSectionProps) {
  const fields = hit.document.fields
  const nights = numberField(fields.durationDays)
  const [from, setFrom] = useState(() => isoDate(addDays(new Date(), 14)))
  const [to, setTo] = useState(() => isoDate(addDays(new Date(), 120)))
  const [adults, setAdults] = useState(2)
  const [state, setState] = useState<{
    status: "idle" | "loading" | "ready" | "error"
    offers: PackageOffer[]
    retryable: boolean
  }>({ status: "idle", offers: [], retryable: false })

  const search = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }))
    try {
      const res = await fetch(`${getApiUrl()}/v1/admin/catalog/package-offers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: hit.id,
          departureDateFrom: from,
          departureDateTo: to,
          adults,
          ...(nights ? { nights: { min: nights, max: nights } } : {}),
        }),
      })
      const json = (await res.json()) as { offers?: PackageOffer[]; retryable?: boolean }
      setState({
        status: "ready",
        offers: Array.isArray(json.offers) ? json.offers : [],
        retryable: Boolean(json.retryable),
      })
    } catch {
      setState({ status: "error", offers: [], retryable: true })
    }
  }, [hit.id, from, to, adults, nights])

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on open; further searches are explicit
  useEffect(() => {
    void search()
  }, [hit.id])

  const grouped = useMemo(() => groupByDeparture(state.offers), [state.offers])

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium text-sm">Departures & prices</h3>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">From</span>
          <Input
            type="date"
            aria-label="Departures from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">To</span>
          <Input
            type="date"
            aria-label="Departures to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Adults</span>
          <Input
            type="number"
            aria-label="Adults"
            min={1}
            value={adults}
            onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
            className="h-8 w-[80px]"
          />
        </div>
        <Button size="sm" onClick={() => void search()} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Searching…" : "Search"}
        </Button>
      </div>

      {state.status === "loading" && (
        <div className="flex flex-col gap-2">
          {["a", "b", "c"].map((k) => (
            <div key={k} className="h-16 animate-pulse rounded-md bg-muted/40" />
          ))}
        </div>
      )}

      {state.status === "ready" && grouped.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
          {state.retryable
            ? "Live availability is temporarily unavailable. Try again."
            : "No departures found for these dates."}
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-center text-destructive text-sm">
          Could not load live offers. Try again.
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.checkIn} className="rounded-lg border">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
            <div className="font-medium text-sm">
              {formatRange(group.checkIn, group.checkOut)}
              {group.nights != null && (
                <span className="ml-2 text-muted-foreground text-xs">{group.nights} nights</span>
              )}
            </div>
            {group.outbound && (
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <Plane className="h-3.5 w-3.5" />
                {group.outbound.carrier} {group.outbound.origin}→{group.outbound.destination}
                {group.outbound.departureAt ? ` · ${formatTime(group.outbound.departureAt)}` : ""}
              </span>
            )}
          </div>
          <ul className="divide-y">
            {group.offers.map((offer) => (
              <li key={offer.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {offer.board && (
                    <Badge variant="outline" className="font-normal">
                      {BOARD_LABELS[offer.board.toUpperCase()] ?? offer.board}
                    </Badge>
                  )}
                  <span className="truncate text-muted-foreground text-sm">{offer.roomTypeId}</span>
                  {offer.freeCancellationUntil && (
                    <span className="text-emerald-600 text-xs dark:text-emerald-400">
                      Free cancellation
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    {offer.total && (
                      <div className="font-semibold text-sm">{formatMoney(offer.total)}</div>
                    )}
                    {offer.perPerson && (
                      <div className="text-muted-foreground text-xs">
                        {formatMoney(offer.perPerson)} pp
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => onBookOffer?.(hit, offer)}>
                    Book
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

interface DepartureGroup {
  checkIn: string
  checkOut: string | null
  nights: number | null
  outbound: PackageOffer["flights"][number] | null
  offers: PackageOffer[]
}

function groupByDeparture(offers: PackageOffer[]): DepartureGroup[] {
  const map = new Map<string, DepartureGroup>()
  for (const offer of offers) {
    const key = offer.checkIn ?? "—"
    let group = map.get(key)
    if (!group) {
      group = {
        checkIn: key,
        checkOut: offer.checkOut,
        nights: offer.nights,
        outbound: offer.flights[0] ?? null,
        offers: [],
      }
      map.set(key, group)
    }
    group.offers.push(offer)
  }
  for (const group of map.values()) {
    group.offers.sort((a, b) => (a.total?.amountMinor ?? 0) - (b.total?.amountMinor ?? 0))
  }
  return [...map.values()].sort((a, b) => a.checkIn.localeCompare(b.checkIn))
}

function formatMoney(m: { amountMinor: number; currency: string }): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: 0,
  }).format(m.amountMinor / 100)
}

function formatRange(checkIn: string, checkOut: string | null): string {
  const start = formatDay(checkIn)
  const end = checkOut ? formatDay(checkOut) : null
  return end ? `${start} – ${end}` : start
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d)
}

function numberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
