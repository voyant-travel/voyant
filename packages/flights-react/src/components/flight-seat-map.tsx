"use client"

import type { Seat, SeatMap } from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@voyant-travel/ui/components/tooltip"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Plane } from "lucide-react"
import { useFlightsUiI18nOrDefault, useFlightsUiMessagesOrDefault } from "../i18n/index.js"

/**
 * Marker rendered on top of a seat to indicate which passenger picked it.
 * Letter is typically the pax index (1, 2, 3) or initial.
 */
export interface SeatPickMarker {
  seatNumber: string
  /** Single character / short label shown on the seat tile. */
  label: string
  /** Full passenger name for accessible labels; falls back to `label`. */
  name?: string
  /** Tailwind colour utility group, e.g. "bg-primary text-primary-foreground". */
  swatch?: string
}

export interface FlightSeatMapProps {
  seatMap: SeatMap
  /** Active pick markers — typically one per passenger that picked a seat. */
  picks: SeatPickMarker[]
  /** Click handler — invoked with the seat that was clicked (or null on blocked). */
  onSeatClick?: (seat: Seat) => void
  /** Marker shown on the row currently being assigned (e.g. "Adult 1"). */
  highlightedPaxLabel?: string
  className?: string
}

/**
 * Visual seat map. Renders each row of the aircraft using the supplied
 * `columnLayout` (with `null` slots becoming aisles), each seat as a
 * clickable tile colour-coded by status + category. Pick markers overlay
 * the seat to indicate which passenger has that seat.
 *
 * Pure presentational — state lives in the parent step.
 */
export function FlightSeatMap({
  seatMap,
  picks,
  onSeatClick,
  highlightedPaxLabel,
  className,
}: FlightSeatMapProps) {
  const messages = useFlightsUiMessagesOrDefault()
  const aircraftName =
    (seatMap.providerData?.aircraftName as string | undefined) ?? seatMap.aircraft

  return (
    <TooltipProvider delay={200}>
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Plane className="h-3.5 w-3.5" />
          {aircraftName ?? messages.flightSeatMap.cabin}
          {highlightedPaxLabel && (
            <>
              <span className="text-foreground/60">·</span>
              <span className="text-foreground">
                {formatMessage(messages.flightSeatMap.pickingSeatFor, {
                  passenger: highlightedPaxLabel,
                })}
              </span>
            </>
          )}
        </div>
        <div className="rounded-md border bg-card p-4">
          <Cabin seatMap={seatMap} picks={picks} onSeatClick={onSeatClick} messages={messages} />
        </div>
        <Legend messages={messages} />
      </div>
    </TooltipProvider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Cabin({
  seatMap,
  picks,
  onSeatClick,
  messages,
}: {
  seatMap: SeatMap
  picks: SeatPickMarker[]
  onSeatClick?: (seat: Seat) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const layout = seatMap.columnLayout
  const pickIndex = new Map(picks.map((p) => [p.seatNumber, p]))

  return (
    <div className="flex flex-col items-center gap-1">
      <ColumnHeader layout={layout} />
      {seatMap.rows.map((row) => (
        <SeatRowView
          key={row.row}
          rowNumber={row.row}
          layout={layout}
          seats={row.seats}
          pickIndex={pickIndex}
          onSeatClick={onSeatClick}
          messages={messages}
        />
      ))}
    </div>
  )
}

function ColumnHeader({ layout }: { layout: SeatMap["columnLayout"] }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <span className="w-6 shrink-0 text-center font-mono text-[10px] text-muted-foreground" />
      {layout.map((col, i) =>
        col == null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: layout positions are stable -- owner: flights-react; existing suppression is intentional pending typed cleanup.
          <div key={`gap-${i}`} className="w-3 shrink-0" />
        ) : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: layout positions are stable -- owner: flights-react; existing suppression is intentional pending typed cleanup.
            key={`col-${i}`}
            className="w-7 shrink-0 text-center font-mono text-[10px] text-muted-foreground"
          >
            {col}
          </span>
        ),
      )}
    </div>
  )
}

function SeatRowView({
  rowNumber,
  layout,
  seats,
  pickIndex,
  onSeatClick,
  messages,
}: {
  rowNumber: number
  layout: SeatMap["columnLayout"]
  seats: Seat[]
  pickIndex: Map<string, SeatPickMarker>
  onSeatClick?: (seat: Seat) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const seatByCol = new Map(seats.map((s) => [s.column, s]))
  return (
    <div className="flex items-center gap-1">
      <span className="w-6 shrink-0 text-center font-mono text-[10px] text-muted-foreground tabular-nums">
        {rowNumber}
      </span>
      {layout.map((col, i) => {
        if (col == null) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: layout positions are stable -- owner: flights-react; existing suppression is intentional pending typed cleanup.
            <div key={`aisle-${rowNumber}-${i}`} className="w-3 shrink-0" />
          )
        }
        const seat = seatByCol.get(col)
        if (!seat) {
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: layout positions are stable -- owner: flights-react; existing suppression is intentional pending typed cleanup.
              key={`gap-${rowNumber}-${i}`}
              className="h-7 w-7 shrink-0 rounded-md border border-dashed border-muted/30"
            />
          )
        }
        return (
          <SeatTile
            key={seat.seatNumber}
            seat={seat}
            pick={pickIndex.get(seat.seatNumber) ?? null}
            onClick={onSeatClick}
            messages={messages}
          />
        )
      })}
    </div>
  )
}

function SeatTile({
  seat,
  pick,
  onClick,
  messages,
}: {
  seat: Seat
  pick: SeatPickMarker | null
  onClick?: (seat: Seat) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const { locale } = useFlightsUiI18nOrDefault()
  const isClickable =
    !!onClick && (seat.status === "available" || seat.status === "selected" || pick != null)
  const tile = (
    <button
      type="button"
      aria-label={seatAriaLabel(seat, pick, messages, locale)}
      disabled={!isClickable}
      onClick={onClick ? () => onClick(seat) : undefined}
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] transition-colors",
        seat.status === "available" && categoryClasses(seat.category),
        seat.status === "blocked" && "cursor-not-allowed border-transparent bg-muted/60",
        seat.status === "unavailable" && "cursor-not-allowed border-transparent bg-muted/30",
        pick && (pick.swatch ?? "bg-primary text-primary-foreground border-primary"),
        isClickable && !pick && "hover:border-primary hover:bg-primary/5",
      )}
    >
      {pick ? <span className="font-semibold">{pick.label}</span> : null}
      {seat.category === "exit_row" && !pick && (
        <span className="absolute top-0 right-0 text-[7px] font-bold leading-none text-amber-600">
          {/* i18n-literal-ok compact exit-row seat marker */}E
        </span>
      )}
    </button>
  )
  if (!isClickable && seat.status !== "available") return tile
  return (
    <Tooltip>
      <TooltipTrigger render={tile} />
      <TooltipContent className="max-w-[220px]">
        <SeatTooltip seat={seat} pickedBy={pick?.label} messages={messages} />
      </TooltipContent>
    </Tooltip>
  )
}

function SeatTooltip({
  seat,
  pickedBy,
  messages,
}: {
  seat: Seat
  pickedBy?: string
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const { locale } = useFlightsUiI18nOrDefault()
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-semibold">{seat.seatNumber}</span>
        <span className="text-muted-foreground">
          {humanCategory(seat.category, messages)}
          {seat.window && ` · ${messages.flightSeatMap.window}`}
          {seat.aisle && ` · ${messages.flightSeatMap.aisle}`}
        </span>
      </div>
      {seat.price ? (
        <span className="font-medium">
          +{formatMoney(seat.price.amount, seat.price.currency, locale)}
        </span>
      ) : (
        <span className="text-muted-foreground">{messages.flightSeatMap.noCharge}</span>
      )}
      {seat.notes && <span className="text-muted-foreground">{seat.notes}</span>}
      {pickedBy && (
        <span className="text-primary">
          {formatMessage(messages.flightSeatMap.pickedBy, { passenger: pickedBy })}
        </span>
      )}
    </div>
  )
}

function Legend({ messages }: { messages: ReturnType<typeof useFlightsUiMessagesOrDefault> }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
      <LegendChip
        className="border-emerald-500/60 bg-card"
        label={messages.flightSeatMap.legend.available}
      />
      <LegendChip
        className="border-cyan-500/60 bg-cyan-500/5"
        label={messages.flightSeatMap.legend.preferred}
      />
      <LegendChip
        className="border-amber-500/60 bg-amber-500/5"
        label={messages.flightSeatMap.legend.exitRow}
      />
      <LegendChip
        className="bg-primary text-primary-foreground"
        label={messages.flightSeatMap.legend.picked}
      />
      <LegendChip className="bg-muted/60" label={messages.flightSeatMap.legend.taken} />
    </div>
  )
}

function LegendChip({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3.5 w-3.5 rounded-sm border", className)} />
      {label}
    </span>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Accessible name for a seat tile. Composes the seat number with its status,
 * and (for available seats) the cabin category + price so screen readers
 * announce the same information the visual tile + tooltip convey.
 */
function seatAriaLabel(
  seat: Seat,
  pick: SeatPickMarker | null,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
  locale: string,
): string {
  const m = messages.flightSeatMap
  if (pick) {
    return formatMessage(m.seatSelectedFor, {
      seat: seat.seatNumber,
      passenger: pick.name ?? pick.label,
    })
  }
  if (seat.status === "available" || seat.status === "selected") {
    // A "selected" status with no local pick marker is a preselected/held seat;
    // announce it as selected rather than collapsing it into "available".
    const prefix =
      seat.status === "selected"
        ? formatMessage(m.seatSelected, { seat: seat.seatNumber })
        : formatMessage(m.seatAvailable, { seat: seat.seatNumber })
    const parts = [prefix, humanCategory(seat.category, messages)]
    if (seat.price) {
      parts.push(formatMoney(seat.price.amount, seat.price.currency, locale))
    }
    return parts.join(", ")
  }
  return formatMessage(m.seatUnavailable, { seat: seat.seatNumber })
}

function categoryClasses(category: Seat["category"]): string {
  switch (category) {
    case "exit_row":
      return "border-amber-500/60 bg-amber-500/5 text-amber-700"
    case "preferred":
    case "extra_legroom":
      return "border-cyan-500/60 bg-cyan-500/5 text-cyan-700"
    case "premium":
    case "bulkhead":
      return "border-violet-500/60 bg-violet-500/5 text-violet-700"
    default:
      return "border-emerald-500/60 bg-card text-emerald-700"
  }
}

function humanCategory(
  c: Seat["category"],
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): string {
  switch (c) {
    case "exit_row":
      return messages.flightSeatMap.categories.exit_row
    case "extra_legroom":
      return messages.flightSeatMap.categories.extra_legroom
    case "preferred":
      return messages.flightSeatMap.categories.preferred
    case "premium":
      return messages.flightSeatMap.categories.premium
    case "bulkhead":
      return messages.flightSeatMap.categories.bulkhead
    default:
      return messages.flightSeatMap.categories.standard
  }
}

function formatMoney(amount: string, currency: string, locale: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}
