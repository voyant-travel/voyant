"use client"

import type {
  AncillaryBaggageOption,
  AncillaryCatalog,
  AncillarySelection,
  FlightOffer,
  FlightPassenger,
  PassengerCounts,
} from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import { Label } from "@voyant-travel/ui/components/label"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Briefcase, CheckCircle2, Luggage } from "lucide-react"
import { useMemo } from "react"
import { useFlightsUiI18nOrDefault, useFlightsUiMessagesOrDefault } from "../i18n/index.js"

type BaggagePicks = NonNullable<AncillarySelection["baggage"]>
type BaggagePick = BaggagePicks[number]

export interface FlightBaggageStepProps {
  /** Per-leg catalogs. Outbound is required; return only when round-trip. */
  outboundCatalog: AncillaryCatalog | null
  returnCatalog?: AncillaryCatalog | null
  /** Carrier-friendly leg labels for cards. */
  outboundOffer: FlightOffer
  returnOffer?: FlightOffer
  /**
   * Passengers, in slot order. Pulled from the passengers step for labels;
   * if some are still blank-named, fall back to "Adult 1", "Child 1", etc.
   */
  passengers: FlightPassenger[]
  /** Fallback when passengers haven't been entered yet. */
  passengerCounts: PassengerCounts
  value: BaggagePicks
  onChange: (next: BaggagePicks) => void
  /** Mirror outbound picks to return — UI toggle, defaults true on round-trip. */
  sameForBothDirections: boolean
  onSameForBothDirectionsChange: (next: boolean) => void
  loading?: boolean
}

/**
 * Wizz-style baggage step. Tiered grid (10/20/26/32 kg with "Recommended"
 * highlight) per passenger per leg, plus a "skip checked bag" path. The
 * "same for both directions" toggle mirrors outbound picks to the return
 * leg — kept on by default per LCC convention.
 */
export function FlightBaggageStep({
  outboundCatalog,
  returnCatalog,
  outboundOffer,
  returnOffer,
  passengers,
  passengerCounts,
  value,
  onChange,
  sameForBothDirections,
  onSameForBothDirectionsChange,
  loading,
}: FlightBaggageStepProps) {
  const messages = useFlightsUiMessagesOrDefault()
  const isRoundTrip = !!returnOffer
  const paxRows = useMemo(
    () => buildPassengerRows(passengers, passengerCounts, messages),
    [passengers, passengerCounts, messages],
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-8 w-64 animate-pulse rounded bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      </div>
    )
  }

  if (!outboundCatalog) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        {messages.flightBaggageStep.unavailable}
      </div>
    )
  }

  const setPick = (next: BaggagePick | null, removeMatch: BaggagePick): void => {
    const filtered = value.filter(
      (p) =>
        !(p.passengerId === removeMatch.passengerId && p.sliceIndex === removeMatch.sliceIndex),
    )
    const updated = next ? [...filtered, next] : filtered
    if (sameForBothDirections && isRoundTrip && removeMatch.sliceIndex === 0) {
      // Mirror to return leg (slice 1) — strip then re-add the same option.
      const noReturn = updated.filter(
        (p) => !(p.passengerId === removeMatch.passengerId && p.sliceIndex === 1),
      )
      const mirrored = next ? [...noReturn, { ...next, sliceIndex: 1 }] : noReturn
      onChange(mirrored)
      return
    }
    onChange(updated)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base">{messages.flightBaggageStep.title}</h2>
          <p className="text-muted-foreground text-sm">{messages.flightBaggageStep.description}</p>
        </div>
        {isRoundTrip && (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <Checkbox
              id="baggage-same-for-both"
              checked={sameForBothDirections}
              onCheckedChange={(v) => onSameForBothDirectionsChange(!!v)}
            />
            <label htmlFor="baggage-same-for-both" className="cursor-pointer">
              {messages.flightBaggageStep.sameForBothDirections}
            </label>
          </div>
        )}
      </div>

      <BaggageLegSection
        legLabel={messages.common.legLabels.outbound}
        catalog={outboundCatalog}
        offer={outboundOffer}
        passengers={paxRows}
        sliceIndex={0}
        value={value}
        messages={messages}
        onPick={setPick}
      />

      {isRoundTrip && returnCatalog && !sameForBothDirections && (
        <BaggageLegSection
          legLabel={messages.common.legLabels.return}
          catalog={returnCatalog}
          offer={returnOffer ?? outboundOffer}
          passengers={paxRows}
          sliceIndex={1}
          value={value}
          messages={messages}
          onPick={setPick}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface PaxRow {
  passengerId: string
  label: string
}

function BaggageLegSection({
  legLabel,
  catalog,
  offer,
  passengers,
  sliceIndex,
  value,
  onPick,
  messages,
}: {
  legLabel: string
  catalog: AncillaryCatalog
  offer: FlightOffer
  passengers: PaxRow[]
  sliceIndex: number
  value: BaggagePicks
  onPick: (next: BaggagePick | null, removeMatch: BaggagePick) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const { locale } = useFlightsUiI18nOrDefault()
  const itin = offer.itineraries[0]
  const first = itin?.segments[0]
  const last = itin?.segments[itin.segments.length - 1]

  return (
    <section className="rounded-md border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-sm">
          <Luggage className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-muted-foreground" />
          {formatMessage(messages.flightBaggageStep.bags, { leg: legLabel })}
        </h3>
        {first && last && (
          <span className="text-muted-foreground text-xs">
            {first.departure.iataCode} → {last.arrival.iataCode} ·{" "}
            {formatDate(first.departure.at, locale)}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {passengers.map((pax) => {
          const pick = value.find(
            (p) => p.passengerId === pax.passengerId && p.sliceIndex === sliceIndex,
          )
          return (
            <PaxBaggageRow
              key={pax.passengerId}
              pax={pax}
              options={catalog.baggage}
              selectedOptionId={pick?.optionId ?? null}
              messages={messages}
              onSelect={(optionId) =>
                onPick(
                  optionId
                    ? { passengerId: pax.passengerId, sliceIndex, optionId, quantity: 1 }
                    : null,
                  { passengerId: pax.passengerId, sliceIndex, optionId: "" },
                )
              }
            />
          )
        })}
      </div>
    </section>
  )
}

function PaxBaggageRow({
  pax,
  options,
  selectedOptionId,
  onSelect,
  messages,
}: {
  pax: PaxRow
  options: AncillaryBaggageOption[]
  selectedOptionId: string | null
  onSelect: (optionId: string | null) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const { locale } = useFlightsUiI18nOrDefault()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-medium text-sm">{pax.label}</Label>
        {selectedOptionId == null && (
          <span className="text-[11px] text-muted-foreground">
            {messages.flightBaggageStep.noCheckedBag}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1.5 rounded-md border bg-card p-3 text-center transition-colors",
            selectedOptionId == null
              ? "border-primary ring-2 ring-primary/20"
              : "hover:border-primary/40 hover:bg-accent/30",
          )}
        >
          {selectedOptionId == null && (
            <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />
          )}
          <Briefcase className="h-7 w-7 text-muted-foreground/70" />
          <span className="font-semibold text-base">{messages.flightBaggageStep.noCheckedBag}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {messages.common.included}
          </span>
        </button>
        {options.map((opt) => {
          const isSelected = selectedOptionId === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : opt.id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 rounded-md border bg-card p-3 text-center transition-colors",
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-primary/40 hover:bg-accent/30",
                opt.recommended && !isSelected && "border-primary/40",
              )}
            >
              {opt.recommended && (
                <span className="-translate-y-1/2 absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 font-medium text-[9px] text-primary-foreground uppercase tracking-wider">
                  {messages.common.recommended}
                </span>
              )}
              {isSelected && (
                <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />
              )}
              <Briefcase className="h-7 w-7 text-muted-foreground" />
              <span className="font-semibold text-base">
                {opt.weightKg ? `${opt.weightKg} kg` : opt.label}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {opt.price.amount === "0.00"
                  ? messages.common.included
                  : `+${formatMoney(opt.price.amount, opt.price.currency, locale)}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPassengerRows(
  passengers: FlightPassenger[],
  counts: PassengerCounts,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): PaxRow[] {
  if (passengers.length > 0) {
    return passengers.map((p) => ({
      passengerId: p.passengerId,
      label: nameOrFallback(p, messages),
    }))
  }
  // Synthesize from counts when passengers haven't been filled yet.
  const out: PaxRow[] = []
  for (let i = 1; i <= counts.adults; i++) {
    out.push({
      passengerId: `pax_adult_${i}`,
      label: `${messages.common.passengerTypeLabels.adult} ${i}`,
    })
  }
  for (let i = 1; i <= (counts.children ?? 0); i++) {
    out.push({
      passengerId: `pax_child_${i}`,
      label: `${messages.common.passengerTypeLabels.child} ${i}`,
    })
  }
  for (let i = 1; i <= (counts.infants ?? 0); i++) {
    out.push({
      passengerId: `pax_infant_${i}`,
      label: `${messages.common.passengerTypeLabels.infant} ${i}`,
    })
  }
  return out
}

function nameOrFallback(
  p: FlightPassenger,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): string {
  const full = `${p.firstName} ${p.lastName}`.trim()
  if (full) return full
  const idx = p.passengerId.match(/_(\d+)$/)?.[1] ?? "1"
  return `${messages.common.passengerTypeLabels[p.type]} ${idx}`
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

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d)
}
