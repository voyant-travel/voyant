// agent-quality: file-size exception -- owner: flights-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import type {
  AncillarySelection,
  FlightOffer,
  FlightPassenger,
  FlightSegment,
  PassengerCounts,
  Seat,
  SeatMap,
} from "@voyant-travel/flights/contract/types"
import { cn } from "@voyant-travel/ui/lib/utils"
import { CheckCircle2, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import { FlightSeatMap, type SeatPickMarker } from "./flight-seat-map.js"

type SeatPicks = NonNullable<AncillarySelection["seats"]>

type SeatMode = "skip" | "auto" | "now"

/**
 * Per-segment seat map fetcher contract. The step calls this with the
 * segment id once the user enters "pick now" mode for a given segment;
 * the parent owns the actual TanStack Query call.
 */
export interface FlightSeatMapSlot {
  /** Map for this segment, or null while loading / errored. */
  seatMap: SeatMap | null
  loading?: boolean
  error?: string | null
}

export interface FlightSeatsStepProps {
  outboundOffer: FlightOffer
  returnOffer?: FlightOffer
  passengers: FlightPassenger[]
  passengerCounts: PassengerCounts
  /** Map fetcher invoked with each segment id the user navigates to. */
  getSeatMap: (segment: { offerId: string; segmentId: string }) => FlightSeatMapSlot
  value: SeatPicks
  onChange: (next: SeatPicks) => void
  /** Tri-option mode the user has chosen — "skip" / "auto" / "now". */
  mode: SeatMode
  onModeChange: (next: SeatMode) => void
}

/**
 * Wizz-style seat selection step. Tri-option gate up top (Skip / Auto-assign
 * / Pick now) — the first two short-circuit straight to the next step. When
 * the user opens "pick now", they get per-segment tabs and a per-passenger
 * row showing each pax's currently picked seat (or "select"). Clicking a
 * seat assigns it to the active passenger and moves the cursor on.
 */
export function FlightSeatsStep({
  outboundOffer,
  returnOffer,
  passengers,
  passengerCounts,
  getSeatMap,
  value,
  onChange,
  mode,
  onModeChange,
}: FlightSeatsStepProps) {
  const messages = useFlightsUiMessagesOrDefault()
  const segments = useMemo(
    () => collectSegments(outboundOffer, returnOffer, messages),
    [outboundOffer, returnOffer, messages],
  )
  const paxRows = useMemo(
    () => buildPassengerRows(passengers, passengerCounts, messages),
    [passengers, passengerCounts, messages],
  )

  const [activeSegmentIdx, setActiveSegmentIdx] = useState(0)
  const [activePaxIdx, setActivePaxIdx] = useState(0)

  // Auto-advance to the next pax once a seat is picked for the current one.
  useEffect(() => {
    if (mode !== "now") return
    const segId = segments[activeSegmentIdx]?.segmentId
    if (!segId) return
    const pickedAll =
      paxRows.length > 0 &&
      paxRows.every((p) =>
        value.some((v) => v.passengerId === p.passengerId && v.segmentId === segId),
      )
    if (pickedAll) {
      // All pax picked for this segment — advance to next segment if any.
      if (activeSegmentIdx < segments.length - 1) {
        setActiveSegmentIdx((i) => i + 1)
        setActivePaxIdx(0)
      }
    }
  }, [value, segments, activeSegmentIdx, paxRows, mode])

  const activeSegment = segments[activeSegmentIdx] ?? null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-base">{messages.flightSeatsStep.title}</h2>
        <p className="text-muted-foreground text-sm">{messages.flightSeatsStep.description}</p>
      </div>

      <ModePicker mode={mode} onChange={onModeChange} messages={messages} />

      {mode === "now" && activeSegment && (
        <div className="flex flex-col gap-4">
          <SegmentTabs
            segments={segments}
            activeIdx={activeSegmentIdx}
            paxCount={paxRows.length}
            picks={value}
            onChange={(idx) => {
              setActiveSegmentIdx(idx)
              setActivePaxIdx(0)
            }}
          />

          <PaxBar
            paxRows={paxRows}
            activeIdx={activePaxIdx}
            picks={value}
            segmentId={activeSegment.segmentId}
            onActivate={setActivePaxIdx}
            onClear={(passengerId) => {
              onChange(
                value.filter(
                  (v) =>
                    !(v.passengerId === passengerId && v.segmentId === activeSegment.segmentId),
                ),
              )
            }}
          />

          <SeatMapPanel
            slot={getSeatMap({
              offerId: activeSegment.offerId,
              segmentId: activeSegment.segmentId,
            })}
            paxRows={paxRows}
            activePaxIdx={activePaxIdx}
            picks={value}
            segmentId={activeSegment.segmentId}
            messages={messages}
            onPick={(seat) => {
              const pax = paxRows[activePaxIdx]
              if (!pax) return
              const filtered = value.filter(
                (v) =>
                  !(v.passengerId === pax.passengerId && v.segmentId === activeSegment.segmentId),
              )
              onChange([
                ...filtered,
                {
                  passengerId: pax.passengerId,
                  segmentId: activeSegment.segmentId,
                  seatNumber: seat.seatNumber,
                },
              ])
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface PaxRow {
  passengerId: string
  label: string
  short: string
  swatch: string
}

interface SegmentRow {
  offerId: string
  segmentId: string
  legLabel: string
  origin: string
  destination: string
  carrier: string
  flightNumber: string
}

const PAX_SWATCHES = [
  "bg-primary text-primary-foreground border-primary",
  "bg-violet-600 text-white border-violet-700",
  "bg-amber-600 text-white border-amber-700",
  "bg-rose-600 text-white border-rose-700",
  "bg-teal-600 text-white border-teal-700",
  "bg-indigo-600 text-white border-indigo-700",
]

function ModePicker({
  mode,
  onChange,
  messages,
}: {
  mode: SeatMode
  onChange: (next: SeatMode) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      <ModeCard
        active={mode === "skip"}
        onClick={() => onChange("skip")}
        title={messages.flightSeatsStep.modes.skip.title}
        body={messages.flightSeatsStep.modes.skip.body}
      />
      <ModeCard
        active={mode === "auto"}
        onClick={() => onChange("auto")}
        title={messages.flightSeatsStep.modes.auto.title}
        body={messages.flightSeatsStep.modes.auto.body}
        recommended
        messages={messages}
      />
      <ModeCard
        active={mode === "now"}
        onClick={() => onChange("now")}
        title={messages.flightSeatsStep.modes.now.title}
        body={messages.flightSeatsStep.modes.now.body}
      />
    </div>
  )
}

function ModeCard({
  active,
  onClick,
  title,
  body,
  recommended,
  messages,
}: {
  active: boolean
  onClick: () => void
  title: string
  body: string
  recommended?: boolean
  messages?: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-1 rounded-md border bg-card p-4 text-left transition-colors",
        active ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40",
      )}
    >
      {recommended && (
        <span className="absolute top-2 right-2 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[9px] text-primary uppercase tracking-wider">
          {messages?.common.recommended}
        </span>
      )}
      {active && <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />}
      <span className="font-medium text-sm">{title}</span>
      <span className="text-muted-foreground text-xs">{body}</span>
    </button>
  )
}

function SegmentTabs({
  segments,
  activeIdx,
  paxCount,
  picks,
  onChange,
}: {
  segments: SegmentRow[]
  activeIdx: number
  paxCount: number
  picks: SeatPicks
  onChange: (idx: number) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-md border bg-muted/20 p-1">
      {segments.map((seg, idx) => {
        const segPicks = picks.filter((p) => p.segmentId === seg.segmentId).length
        const complete = segPicks === paxCount && paxCount > 0
        const active = idx === activeIdx
        return (
          <button
            key={seg.segmentId}
            type="button"
            onClick={() => onChange(idx)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors",
              active && "bg-background shadow-sm",
              !active && "text-muted-foreground hover:bg-background/50",
            )}
          >
            {complete && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
            <span className="font-medium">
              {seg.origin} → {seg.destination}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {seg.carrier}
              {seg.flightNumber}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {segPicks}/{paxCount}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PaxBar({
  paxRows,
  activeIdx,
  picks,
  segmentId,
  onActivate,
  onClear,
}: {
  paxRows: PaxRow[]
  activeIdx: number
  picks: SeatPicks
  segmentId: string
  onActivate: (idx: number) => void
  onClear: (passengerId: string) => void
}) {
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {paxRows.map((pax, idx) => {
        const pick = picks.find(
          (p) => p.passengerId === pax.passengerId && p.segmentId === segmentId,
        )
        const active = idx === activeIdx
        return (
          <li key={pax.passengerId}>
            <button
              type="button"
              onClick={() => onActivate(idx)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active ? "border-primary bg-primary/5" : "hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-semibold",
                  pax.swatch,
                )}
              >
                {pax.short}
              </span>
              <span className="font-medium">{pax.label}</span>
              {pick ? (
                <>
                  <span className="font-mono text-[11px] text-foreground">{pick.seatNumber}</span>
                  <X
                    className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClear(pax.passengerId)
                    }}
                  />
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function SeatMapPanel({
  slot,
  paxRows,
  activePaxIdx,
  picks,
  segmentId,
  onPick,
  messages,
}: {
  slot: FlightSeatMapSlot
  paxRows: PaxRow[]
  activePaxIdx: number
  picks: SeatPicks
  segmentId: string
  onPick: (seat: Seat) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  if (slot.loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted/40" />
  }
  if (slot.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
        {slot.error}
      </div>
    )
  }
  if (!slot.seatMap) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        {messages.flightSeatsStep.seatMapUnavailable}
      </div>
    )
  }

  const markers: SeatPickMarker[] = picks
    .filter((p) => p.segmentId === segmentId)
    .map<SeatPickMarker | null>((p) => {
      const paxIdx = paxRows.findIndex((r) => r.passengerId === p.passengerId)
      const pax = paxRows[paxIdx]
      if (!pax) return null
      return { seatNumber: p.seatNumber, label: pax.short, name: pax.label, swatch: pax.swatch }
    })
    .filter((p): p is SeatPickMarker => p !== null)

  return (
    <FlightSeatMap
      seatMap={slot.seatMap}
      picks={markers}
      onSeatClick={(seat) => {
        if (seat.status !== "available" && seat.status !== "selected") return
        onPick(seat)
      }}
      highlightedPaxLabel={paxRows[activePaxIdx]?.label}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function collectSegments(
  outbound: FlightOffer,
  returnLeg: FlightOffer | undefined,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): SegmentRow[] {
  const out: SegmentRow[] = []
  for (const seg of itinerarySegments(outbound)) {
    out.push({
      offerId: outbound.offerId,
      segmentId: seg.segmentId,
      legLabel: messages.common.legLabels.outbound,
      origin: seg.departure.iataCode,
      destination: seg.arrival.iataCode,
      carrier: seg.carrierCode,
      flightNumber: seg.flightNumber,
    })
  }
  if (returnLeg) {
    for (const seg of itinerarySegments(returnLeg)) {
      out.push({
        offerId: returnLeg.offerId,
        segmentId: seg.segmentId,
        legLabel: messages.common.legLabels.return,
        origin: seg.departure.iataCode,
        destination: seg.arrival.iataCode,
        carrier: seg.carrierCode,
        flightNumber: seg.flightNumber,
      })
    }
  }
  return out
}

function itinerarySegments(offer: FlightOffer): FlightSegment[] {
  const out: FlightSegment[] = []
  for (const itin of offer.itineraries) {
    for (const seg of itin.segments) out.push(seg)
  }
  return out
}

function buildPassengerRows(
  passengers: FlightPassenger[],
  counts: PassengerCounts,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): PaxRow[] {
  const rows: PaxRow[] = []
  const total =
    passengers.length > 0
      ? passengers.length
      : counts.adults + (counts.children ?? 0) + (counts.infants ?? 0)
  for (let i = 0; i < total; i++) {
    const p = passengers[i]
    if (p) {
      rows.push({
        passengerId: p.passengerId,
        label: nameOrFallback(p, i, messages),
        short: shortLabel(p, i),
        swatch: PAX_SWATCHES[i % PAX_SWATCHES.length] ?? PAX_SWATCHES[0]!,
      })
    } else {
      rows.push({
        passengerId: synthPaxId(i, counts),
        label: synthPaxLabel(i, counts, messages),
        short: String(i + 1),
        swatch: PAX_SWATCHES[i % PAX_SWATCHES.length] ?? PAX_SWATCHES[0]!,
      })
    }
  }
  return rows
}

function nameOrFallback(
  p: FlightPassenger,
  idx: number,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): string {
  const full = `${p.firstName} ${p.lastName}`.trim()
  if (full) return full
  return `${messages.common.passengerTypeLabels[p.type]} ${idx + 1}`
}

function shortLabel(p: FlightPassenger, idx: number): string {
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.trim()
  if (initials) return initials.toUpperCase()
  return String(idx + 1)
}

function synthPaxId(i: number, counts: PassengerCounts): string {
  if (i < counts.adults) return `pax_adult_${i + 1}`
  const afterAdults = i - counts.adults
  if (afterAdults < (counts.children ?? 0)) return `pax_child_${afterAdults + 1}`
  return `pax_infant_${i - counts.adults - (counts.children ?? 0) + 1}`
}

function synthPaxLabel(
  i: number,
  counts: PassengerCounts,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): string {
  if (i < counts.adults) return `${messages.common.passengerTypeLabels.adult} ${i + 1}`
  const afterAdults = i - counts.adults
  if (afterAdults < (counts.children ?? 0)) {
    return `${messages.common.passengerTypeLabels.child} ${afterAdults + 1}`
  }
  return `${messages.common.passengerTypeLabels.infant} ${
    i - counts.adults - (counts.children ?? 0) + 1
  }`
}
