"use client"

import type {
  AncillaryAssistanceOption,
  AncillaryCatalog,
  AncillaryExtraOption,
  AncillarySelection,
  FlightOffer,
  FlightPassenger,
  PassengerCounts,
} from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Button } from "@voyant-travel/ui/components/button"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Accessibility, Minus, Package, Plus, Sparkles } from "lucide-react"
import { useMemo } from "react"
import { useFlightsUiI18nOrDefault, useFlightsUiMessagesOrDefault } from "../i18n/index.js"

type AssistancePicks = NonNullable<AncillarySelection["assistance"]>
type ExtrasPicks = NonNullable<AncillarySelection["extras"]>

export interface FlightServicesStepProps {
  /** Per-leg catalogs — outbound required, return only when round-trip. */
  outboundCatalog: AncillaryCatalog | null
  returnCatalog?: AncillaryCatalog | null
  outboundOffer: FlightOffer
  returnOffer?: FlightOffer
  passengers: FlightPassenger[]
  passengerCounts: PassengerCounts
  assistance: AssistancePicks
  extras: ExtrasPicks
  onAssistanceChange: (next: AssistancePicks) => void
  onExtrasChange: (next: ExtrasPicks) => void
  loading?: boolean
}

/**
 * Combined services step covering special assistance (per-pax, trip-wide)
 * and extras (per-pax, per-leg). Assistance is a flat checkbox list per
 * passenger; extras are stepper-style line items so the operator can add
 * multiples (e.g. two pets in cabin). Both are optional — passengers can
 * leave the step blank and continue.
 */
export function FlightServicesStep({
  outboundCatalog,
  returnCatalog,
  outboundOffer,
  returnOffer,
  passengers,
  passengerCounts,
  assistance,
  extras,
  onAssistanceChange,
  onExtrasChange,
  loading,
}: FlightServicesStepProps) {
  const messages = useFlightsUiMessagesOrDefault()
  const isRoundTrip = !!returnOffer
  const paxRows = useMemo(
    () => buildPassengerRows(passengers, passengerCounts, messages),
    [passengers, passengerCounts, messages],
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      </div>
    )
  }

  if (!outboundCatalog) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        {messages.flightServicesStep.servicesUnavailable}
      </div>
    )
  }

  const toggleAssistance = (passengerId: string, optionId: string, checked: boolean) => {
    const filtered = assistance.filter(
      (p) => !(p.passengerId === passengerId && p.optionId === optionId),
    )
    if (checked) {
      onAssistanceChange([...filtered, { passengerId, optionId }])
    } else {
      onAssistanceChange(filtered)
    }
  }

  const setExtraQty = (
    passengerId: string,
    sliceIndex: number,
    optionId: string,
    quantity: number,
  ) => {
    const filtered = extras.filter(
      (p) =>
        !(p.passengerId === passengerId && p.sliceIndex === sliceIndex && p.optionId === optionId),
    )
    if (quantity > 0) {
      onExtrasChange([...filtered, { passengerId, sliceIndex, optionId, quantity }])
    } else {
      onExtrasChange(filtered)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-base">{messages.flightServicesStep.title}</h2>
        <p className="text-muted-foreground text-sm">{messages.flightServicesStep.description}</p>
      </div>

      <AssistanceSection
        passengers={paxRows}
        options={outboundCatalog.assistance}
        value={assistance}
        onToggle={toggleAssistance}
        messages={messages}
      />

      <ExtrasSection
        legLabel={messages.common.legLabels.outbound}
        offer={outboundOffer}
        catalog={outboundCatalog}
        passengers={paxRows}
        sliceIndex={0}
        value={extras}
        onSetQty={setExtraQty}
        messages={messages}
      />

      {isRoundTrip && returnCatalog && returnOffer && (
        <ExtrasSection
          legLabel={messages.common.legLabels.return}
          offer={returnOffer}
          catalog={returnCatalog}
          passengers={paxRows}
          sliceIndex={1}
          value={extras}
          onSetQty={setExtraQty}
          messages={messages}
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

function AssistanceSection({
  passengers,
  options,
  value,
  onToggle,
  messages,
}: {
  passengers: PaxRow[]
  options: AncillaryAssistanceOption[]
  value: AssistancePicks
  onToggle: (passengerId: string, optionId: string, checked: boolean) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <section className="rounded-md border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <Accessibility className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium text-sm">{messages.flightServicesStep.specialAssistance}</h3>
      </header>

      <div className="flex flex-col gap-4">
        {passengers.map((pax) => {
          const paxPicks = value.filter((v) => v.passengerId === pax.passengerId)
          return (
            <div key={pax.passengerId} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-sm">{pax.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {paxPicks.length === 0
                    ? messages.flightServicesStep.noAssistanceNeeded
                    : `${paxPicks.length} ${messages.common.selected}`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const checked = paxPicks.some((p) => p.optionId === opt.id)
                  const id = `svc-${pax.passengerId}-${opt.id}`
                  return (
                    <div
                      key={opt.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/40 hover:bg-accent/30",
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(v) => onToggle(pax.passengerId, opt.id, !!v)}
                      />
                      <label htmlFor={id} className="cursor-pointer">
                        {opt.label}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ExtrasSection({
  legLabel,
  offer,
  catalog,
  passengers,
  sliceIndex,
  value,
  onSetQty,
  messages,
}: {
  legLabel: string
  offer: FlightOffer
  catalog: AncillaryCatalog
  passengers: PaxRow[]
  sliceIndex: number
  value: ExtrasPicks
  onSetQty: (passengerId: string, sliceIndex: number, optionId: string, quantity: number) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  if (catalog.extras.length === 0) return null
  const itin = offer.itineraries[0]
  const first = itin?.segments[0]
  const last = itin?.segments[itin.segments.length - 1]

  return (
    <section className="rounded-md border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium text-sm">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          {formatMessage(messages.flightServicesStep.extras, { leg: legLabel })}
        </h3>
        {first && last && (
          <span className="text-muted-foreground text-xs">
            {first.departure.iataCode} → {last.arrival.iataCode}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {passengers.map((pax) => (
          <div key={pax.passengerId} className="flex flex-col gap-2">
            <span className="font-medium text-sm">{pax.label}</span>
            <ul className="flex flex-col gap-1.5">
              {catalog.extras.map((opt) => {
                const pick = value.find(
                  (v) =>
                    v.passengerId === pax.passengerId &&
                    v.sliceIndex === sliceIndex &&
                    v.optionId === opt.id,
                )
                const qty = pick?.quantity ?? 0
                return (
                  <ExtraRow
                    key={opt.id}
                    option={opt}
                    quantity={qty}
                    legLabel={legLabel}
                    passengerLabel={pax.label}
                    messages={messages}
                    onChange={(next) => onSetQty(pax.passengerId, sliceIndex, opt.id, next)}
                  />
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function ExtraRow({
  option,
  quantity,
  legLabel,
  passengerLabel,
  messages,
  onChange,
}: {
  option: AncillaryExtraOption
  quantity: number
  legLabel: string
  passengerLabel: string
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
  onChange: (next: number) => void
}) {
  const { locale } = useFlightsUiI18nOrDefault()
  const labelArgs = { leg: legLabel, service: option.label, passenger: passengerLabel }
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{option.label}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatMoney(option.price.amount, option.price.currency, locale)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          aria-label={formatMessage(messages.flightServicesStep.decreaseExtra, labelArgs)}
          onClick={() => onChange(Math.max(0, quantity - 1))}
          disabled={quantity === 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="min-w-6 text-center font-medium text-sm tabular-nums">{quantity}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          aria-label={formatMessage(messages.flightServicesStep.increaseExtra, labelArgs)}
          onClick={() => onChange(Math.min(9, quantity + 1))}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </li>
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
