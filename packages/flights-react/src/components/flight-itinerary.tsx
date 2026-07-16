"use client"

import type { FlightSegment, Itinerary } from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components/badge"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Plane } from "lucide-react"

import { useFlightsUiI18nOrDefault, type useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import { AirlineLogo } from "./airline-logo.js"

export interface FlightItineraryProps {
  itinerary: Itinerary
  /** Optional label shown above the segment list (e.g. "Outbound", "Return"). */
  label?: string
  /** Optional sub-label, typically the dated city pair: "BUH → LON · Mon, 13 Jul". */
  sublabel?: string
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  aircraftName?: (iataCode: string) => string | undefined
  /** Compact rendering for use inside the ledger / right rail. */
  compact?: boolean
  className?: string
}

/**
 * Carrier-aware itinerary renderer. One itinerary = one direction of travel
 * (outbound, return, or one leg of an open-jaw). Surfaces:
 *  - per-segment carrier + flight number
 *  - operating-vs-marketing carrier ("Operated by …") for codeshares
 *  - layover dwell time chips between segments
 *  - aircraft per segment
 *  - total journey duration
 *
 * `compact` strips the per-segment cards down to a single timeline row —
 * suitable for the booking ledger.
 */
export function FlightItinerary({
  itinerary,
  label,
  sublabel,
  carrierName,
  airportName,
  aircraftName,
  compact,
  className,
}: FlightItineraryProps) {
  const { locale, messages } = useFlightsUiI18nOrDefault()
  const segs = itinerary.segments
  const first = segs[0]
  const last = segs[segs.length - 1]
  if (!first || !last) return null

  const stops = segs.length - 1
  const totalDuration = itinerary.duration ?? deriveDuration(first, last)
  const carriers = Array.from(new Set(segs.map((s) => s.carrierCode)))

  if (compact) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {(label || sublabel) && (
          <div className="flex items-baseline justify-between gap-2">
            {label && (
              <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
            )}
            {sublabel && <span className="text-[11px] text-muted-foreground">{sublabel}</span>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center -space-x-1">
            {carriers.map((code) => (
              <AirlineLogo key={code} iataCode={code} name={carrierName?.(code)} size={20} />
            ))}
          </div>
          <span className="font-mono text-xs text-foreground">
            {first.departure.iataCode} → {last.arrival.iataCode}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatTime(first.departure.at, locale)} – {formatTime(last.arrival.at, locale)}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {formatStops(stops, messages)}
            {totalDuration && ` · ${formatDuration(totalDuration)}`}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(label || sublabel) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <h4 className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
              {label}
            </h4>
          )}
          {(sublabel || totalDuration) && (
            <span className="text-[11px] text-muted-foreground">
              {sublabel}
              {sublabel && totalDuration && " · "}
              {totalDuration &&
                formatMessage(messages.flightItinerary.totalDuration, {
                  duration: formatDuration(totalDuration),
                })}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col">
        {segs.map((seg, idx) => (
          <SegmentBlock
            key={seg.segmentId}
            segment={seg}
            carrierName={carrierName}
            airportName={airportName}
            aircraftName={aircraftName}
            messages={messages}
            layoverBefore={idx > 0 ? layoverBetween(segs[idx - 1], seg) : null}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SegmentBlock({
  segment,
  carrierName,
  airportName,
  aircraftName,
  messages,
  layoverBefore,
}: {
  segment: FlightSegment
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  aircraftName?: (iataCode: string) => string | undefined
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
  layoverBefore: { airport: string; dwell: string } | null
}) {
  const isCodeshare =
    segment.operatingCarrierCode != null && segment.operatingCarrierCode !== segment.carrierCode

  return (
    <>
      {layoverBefore && (
        <div className="my-1 flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {messages.flightItinerary.layover} ·{" "}
            {formatMessage(messages.flightItinerary.layoverIn, {
              duration: layoverBefore.dwell,
              airport: layoverBefore.airport,
            })}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
      <div className="rounded-md border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <AirlineLogo
            iataCode={segment.carrierCode}
            name={carrierName?.(segment.carrierCode)}
            size={24}
          />
          <span className="font-medium text-sm">
            {carrierName?.(segment.carrierCode) ?? segment.carrierCode}
          </span>
          <span className="font-mono text-muted-foreground text-xs">
            {segment.carrierCode}
            {segment.flightNumber}
          </span>
          {isCodeshare && (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {formatMessage(messages.flightItinerary.operatedBy, {
                carrier:
                  carrierName?.(segment.operatingCarrierCode ?? "") ??
                  segment.operatingCarrierCode ??
                  "",
              })}
            </Badge>
          )}
          <Badge variant="outline" className="ml-auto capitalize">
            {messages.common.cabinLabels[segment.cabin]}
          </Badge>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Endpoint
            at={segment.departure.at}
            iata={segment.departure.iataCode}
            terminal={segment.departure.terminal}
            airportName={airportName?.(segment.departure.iataCode)}
            messages={messages}
          />
          <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
            <Plane className="h-3.5 w-3.5" />
            {segment.duration && <span>{formatDuration(segment.duration)}</span>}
          </div>
          <Endpoint
            at={segment.arrival.at}
            iata={segment.arrival.iataCode}
            terminal={segment.arrival.terminal}
            airportName={airportName?.(segment.arrival.iataCode)}
            align="end"
            messages={messages}
          />
        </div>
        {segment.aircraft && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {messages.flightItinerary.aircraft}{" "}
            <span className="text-foreground">
              {aircraftName?.(segment.aircraft) ?? segment.aircraft}
            </span>
          </div>
        )}
      </div>
    </>
  )
}

function Endpoint({
  at,
  iata,
  terminal,
  airportName,
  messages,
  align = "start",
}: {
  at: string
  iata: string
  terminal?: string
  airportName?: string
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
  align?: "start" | "end"
}) {
  const { locale } = useFlightsUiI18nOrDefault()
  return (
    <div
      className={cn("flex flex-col leading-tight", align === "end" ? "items-end" : "items-start")}
    >
      <span className="font-semibold text-lg tabular-nums">{formatTime(at, locale)}</span>
      <span className="font-mono text-muted-foreground text-xs">{iata}</span>
      {airportName && <span className="text-[11px] text-muted-foreground">{airportName}</span>}
      {terminal && (
        <span className="text-[10px] text-muted-foreground">
          {formatMessage(messages.flightItinerary.terminal, { terminal })}
        </span>
      )}
      <span className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(at, locale)}</span>
    </div>
  )
}

function formatStops(
  stops: number,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): string {
  if (stops === 0) return messages.common.stops.nonstop
  return formatMessage(
    stops === 1 ? messages.common.stops.oneStop : messages.common.stops.manyStops,
    {
      count: stops,
    },
  )
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatTime(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d)
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d)
}

function formatDuration(iso: string | undefined): string {
  if (!iso) return ""
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso)
  if (!m) return iso
  const h = m[1] ? `${m[1]}h` : ""
  const min = m[2] ? `${m[2]}m` : ""
  return [h, min].filter(Boolean).join(" ") || iso
}

function layoverBetween(
  prev: FlightSegment | undefined,
  next: FlightSegment,
): { airport: string; dwell: string } | null {
  if (!prev) return null
  const a = new Date(prev.arrival.at).getTime()
  const b = new Date(next.departure.at).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null
  const minutes = Math.round((b - a) / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const dwell = [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || `${minutes}m`
  return { airport: prev.arrival.iataCode, dwell }
}

function deriveDuration(first: FlightSegment, last: FlightSegment): string | undefined {
  const a = new Date(first.departure.at).getTime()
  const b = new Date(last.arrival.at).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return undefined
  const minutes = Math.round((b - a) / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `PT${h}H${m}M`
}
