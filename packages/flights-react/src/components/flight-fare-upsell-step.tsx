"use client"

import type {
  AncillarySelection,
  FareBundle,
  FlightOffer,
  FlightPassenger,
  PassengerCounts,
} from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Briefcase, Check, Crown, Luggage, Sparkles, X } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { useFlightsUiI18nOrDefault, useFlightsUiMessagesOrDefault } from "../i18n/index.js"

type FareBundlePicks = NonNullable<AncillarySelection["fareBundle"]>
type FareBundlePick = FareBundlePicks[number]

export interface FlightFareUpsellStepProps {
  outboundOffer: FlightOffer
  returnOffer?: FlightOffer
  /** Filled passenger entries — used for per-pax labels. */
  passengers: FlightPassenger[]
  /** Pax counts when the form hasn't been filled yet (fallback labels). */
  passengerCounts: PassengerCounts
  value: FareBundlePicks
  onChange: (next: FareBundlePicks) => void
  /** Default-on toggle: one pick applies to every passenger on the leg. */
  sameForAllPassengers: boolean
  onSameForAllPassengersChange: (next: boolean) => void
}

/**
 * Per-pax per-leg branded-fare upsell step. For multi-pax bookings the
 * "Same fare for all passengers" toggle (default ON) collapses the picker
 * back to one card grid per leg, keeping the common case ("everyone on
 * Standard") to one click. Toggling off splits each leg into per-pax card
 * grids — useful for the "Adult 1 Plus, Adult 2 Basic" case full-service
 * carriers + B2B agency bookings actually exercise.
 */
export function FlightFareUpsellStep({
  outboundOffer,
  returnOffer,
  passengers,
  passengerCounts,
  value,
  onChange,
  sameForAllPassengers,
  onSameForAllPassengersChange,
}: FlightFareUpsellStepProps) {
  const messages = useFlightsUiMessagesOrDefault()
  const paxRows = useMemo(
    () => buildPassengerRows(passengers, passengerCounts, messages),
    [passengers, passengerCounts, messages],
  )
  const isMultiPax = paxRows.length > 1
  const outboundBundles = outboundOffer.fareBundles ?? []
  const returnBundles = returnOffer?.fareBundles ?? []

  if (outboundBundles.length === 0 && returnBundles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        {messages.flightFareUpsellStep.unavailable}
      </div>
    )
  }

  const setPick = (passengerId: string, sliceIndex: number, bundleId: string | null) => {
    const filtered = value.filter(
      (p) => !(p.passengerId === passengerId && p.sliceIndex === sliceIndex),
    )
    if (bundleId) {
      onChange([...filtered, { passengerId, sliceIndex, bundleId }])
    } else {
      onChange(filtered)
    }
  }

  /**
   * "Same fare for all" handler — picks on behalf of every passenger on the
   * given leg. A null bundleId clears all picks for that leg.
   */
  const setLegPick = (sliceIndex: number, bundleId: string | null) => {
    const filtered = value.filter((p) => p.sliceIndex !== sliceIndex)
    if (!bundleId) {
      onChange(filtered)
      return
    }
    const additions = paxRows.map<FareBundlePick>((p) => ({
      passengerId: p.passengerId,
      sliceIndex,
      bundleId,
    }))
    onChange([...filtered, ...additions])
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base">{messages.flightFareUpsellStep.title}</h2>
          <p className="text-muted-foreground text-sm">
            {messages.flightFareUpsellStep.description}
          </p>
        </div>
        {isMultiPax && (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <Checkbox
              id="fare-same-for-all"
              checked={sameForAllPassengers}
              onCheckedChange={(v) => onSameForAllPassengersChange(!!v)}
            />
            <label htmlFor="fare-same-for-all" className="cursor-pointer">
              {messages.flightFareUpsellStep.sameForAllPassengers}
            </label>
          </div>
        )}
      </div>

      <FareLegSection
        label={messages.common.legLabels.outbound}
        bundles={outboundBundles}
        sliceIndex={0}
        paxRows={paxRows}
        value={value}
        sameForAll={sameForAllPassengers || !isMultiPax}
        onSetPick={setPick}
        onSetLegPick={setLegPick}
        messages={messages}
      />

      {returnOffer && returnBundles.length > 0 && (
        <FareLegSection
          label={messages.common.legLabels.return}
          bundles={returnBundles}
          sliceIndex={1}
          paxRows={paxRows}
          value={value}
          sameForAll={sameForAllPassengers || !isMultiPax}
          onSetPick={setPick}
          onSetLegPick={setLegPick}
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

function FareLegSection({
  label,
  bundles,
  sliceIndex,
  paxRows,
  value,
  sameForAll,
  onSetPick,
  onSetLegPick,
  messages,
}: {
  label: string
  bundles: FareBundle[]
  sliceIndex: number
  paxRows: PaxRow[]
  value: FareBundlePicks
  sameForAll: boolean
  onSetPick: (passengerId: string, sliceIndex: number, bundleId: string | null) => void
  onSetLegPick: (sliceIndex: number, bundleId: string | null) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  // For "same for all" mode we treat the leg as having one selection — the
  // bundleId common to every pax pick on this leg (null when split or none).
  const legPick: string | null = (() => {
    if (paxRows.length === 0) return null
    const ids = paxRows.map(
      (p) =>
        value.find((v) => v.passengerId === p.passengerId && v.sliceIndex === sliceIndex)
          ?.bundleId ?? null,
    )
    if (ids.every((id) => id === ids[0])) return ids[0] ?? null
    return null
  })()
  const someoneSelected = value.some((v) => v.sliceIndex === sliceIndex)

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        {someoneSelected && (
          <button
            type="button"
            onClick={() => onSetLegPick(sliceIndex, null)}
            className="text-muted-foreground text-xs hover:text-foreground"
          >
            {messages.flightFareUpsellStep.resetToBasic}
          </button>
        )}
      </header>

      {sameForAll ? (
        <BundleGrid
          bundles={bundles}
          selectedId={legPick}
          contextLabel={
            paxRows.length > 1
              ? formatMessage(messages.flightFareUpsellStep.appliesToAllPassengers, {
                  count: paxRows.length,
                })
              : null
          }
          onPick={(id) => onSetLegPick(sliceIndex, id)}
          messages={messages}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {paxRows.map((pax) => {
            const pick = value.find(
              (v) => v.passengerId === pax.passengerId && v.sliceIndex === sliceIndex,
            )
            return (
              <div key={pax.passengerId} className="flex flex-col gap-2">
                <span className="font-medium text-sm">{pax.label}</span>
                <BundleGrid
                  bundles={bundles}
                  selectedId={pick?.bundleId ?? null}
                  onPick={(id) => onSetPick(pax.passengerId, sliceIndex, id)}
                  messages={messages}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function BundleGrid({
  bundles,
  selectedId,
  contextLabel,
  onPick,
  messages,
}: {
  bundles: FareBundle[]
  selectedId: string | null
  contextLabel?: string | null
  onPick: (bundleId: string | null) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 md:grid-cols-3">
        {bundles.map((b) => (
          <BundleCard
            key={b.id}
            bundle={b}
            selected={selectedId === b.id}
            isBasicByDefault={selectedId == null && b.tier === "basic"}
            onPick={() => onPick(b.tier === "basic" ? null : b.id)}
            messages={messages}
          />
        ))}
      </div>
      {contextLabel && <span className="text-[11px] text-muted-foreground">{contextLabel}</span>}
    </div>
  )
}

function BundleCard({
  bundle,
  selected,
  isBasicByDefault,
  onPick,
  messages,
}: {
  bundle: FareBundle
  selected: boolean
  isBasicByDefault: boolean
  onPick: () => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const { locale } = useFlightsUiI18nOrDefault()
  const delta = Number(bundle.priceDelta.amount)
  const deltaLabel =
    delta > 0
      ? `+${formatMoney(bundle.priceDelta.amount, bundle.priceDelta.currency, locale)}`
      : messages.common.included
  const showActiveRing = selected || isBasicByDefault

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "relative flex flex-col gap-3 rounded-md border bg-card p-4 text-left transition-colors",
        showActiveRing
          ? "border-primary ring-2 ring-primary/20"
          : "hover:border-primary/40 hover:bg-accent/30",
        bundle.recommended && !showActiveRing && "border-primary/40",
      )}
    >
      {bundle.recommended && (
        <span className="-translate-y-1/2 absolute top-0 left-4 rounded-full bg-primary px-2 py-0.5 font-medium text-[9px] text-primary-foreground uppercase tracking-wider">
          {messages.common.recommended}
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-sm">
          <TierIcon tier={bundle.tier} />
          {bundle.label}
        </span>
        <span
          className={cn("font-medium text-xs", delta > 0 ? "text-foreground" : "text-emerald-600")}
        >
          {deltaLabel}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        <Inclusion
          ok={!!bundle.inclusions.cabinBag?.included}
          icon={<Briefcase className="h-3.5 w-3.5" />}
          label={
            bundle.inclusions.cabinBag?.included
              ? formatMessage(messages.flightFareUpsellStep.cabinBag, {
                  weight: bundle.inclusions.cabinBag.weightKg
                    ? `(${bundle.inclusions.cabinBag.weightKg} kg)`
                    : "",
                }).trim()
              : messages.flightFareUpsellStep.noCabinBag
          }
        />
        <Inclusion
          ok={!!bundle.inclusions.checkedBag?.included}
          icon={<Luggage className="h-3.5 w-3.5" />}
          label={
            bundle.inclusions.checkedBag?.included
              ? formatMessage(messages.flightFareUpsellStep.checkedBag, {
                  weight: bundle.inclusions.checkedBag.weightKg
                    ? `${bundle.inclusions.checkedBag.weightKg} kg`
                    : "",
                  pieces:
                    bundle.inclusions.checkedBag.pieces && bundle.inclusions.checkedBag.pieces > 1
                      ? ` × ${bundle.inclusions.checkedBag.pieces}`
                      : "",
                }).trim()
              : messages.flightFareUpsellStep.noCheckedBag
          }
        />
        <Inclusion
          ok={bundle.inclusions.seatSelection !== "none" && bundle.inclusions.seatSelection != null}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label={
            bundle.inclusions.seatSelection === "free"
              ? messages.flightFareUpsellStep.freeSeatSelection
              : bundle.inclusions.seatSelection === "standard"
                ? messages.flightFareUpsellStep.standardSeatSelection
                : messages.flightFareUpsellStep.noSeatSelection
          }
        />
        <Inclusion
          ok={!!bundle.inclusions.priorityBoarding}
          label={messages.flightFareUpsellStep.priorityBoarding}
        />
        <Inclusion
          ok={!!bundle.inclusions.loungeAccess}
          label={messages.flightFareUpsellStep.loungeAccess}
        />
        <Inclusion
          ok={!!bundle.inclusions.changeable}
          label={
            bundle.inclusions.changeable
              ? messages.flightFareUpsellStep.freeChanges
              : messages.flightFareUpsellStep.changesForFee
          }
        />
        <Inclusion
          ok={!!bundle.inclusions.refundable}
          label={
            bundle.inclusions.refundable
              ? messages.flightFareUpsellStep.refundable
              : messages.flightFareUpsellStep.nonRefundable
          }
        />
        {bundle.inclusions.notes?.map((n) => (
          <Inclusion key={n} ok label={n} />
        ))}
      </ul>
      {selected && (
        <span className="mt-1 inline-flex items-center gap-1 self-start font-medium text-primary text-xs">
          <Check className="h-3 w-3" />
          <span>{messages.common.selected}</span>
        </span>
      )}
    </button>
  )
}

function Inclusion({ ok, icon, label }: { ok: boolean; icon?: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      )}
      <span className="flex items-center gap-1.5 text-foreground">
        {icon}
        <span className={cn(!ok && "text-muted-foreground")}>{label}</span>
      </span>
    </li>
  )
}

function TierIcon({ tier }: { tier: FareBundle["tier"] }) {
  switch (tier) {
    case "plus":
    case "premium":
      return <Crown className="h-3.5 w-3.5 text-amber-500" />
    case "standard":
      return <Sparkles className="h-3.5 w-3.5 text-primary" />
    default:
      return <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

function buildPassengerRows(
  passengers: FlightPassenger[],
  counts: PassengerCounts,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): PaxRow[] {
  if (passengers.length > 0) {
    return passengers.map((p, idx) => ({
      passengerId: p.passengerId,
      label: nameOrFallback(p, idx, messages),
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
  idx: number,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>,
): string {
  const full = `${p.firstName} ${p.lastName}`.trim()
  if (full) return full
  return `${messages.common.passengerTypeLabels[p.type]} ${idx + 1}`
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
