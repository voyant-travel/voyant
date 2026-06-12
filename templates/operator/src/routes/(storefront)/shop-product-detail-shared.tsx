import { Link } from "@tanstack/react-router"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Label } from "@voyantjs/ui/components/label"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import type React from "react"

import type { ContentResolution } from "./shop-product-detail-content"

export interface AvailabilitySlot {
  id: string
  dateLocal: string
  startsAt: string
  endsAt?: string | null
  timezone: string
  status: string
  unlimited: boolean
  remainingPax?: number | null
  initialPax?: number | null
  nights?: number | null
  days?: number | null
}

export function DetailLayout({
  body,
  sidebar,
}: {
  body: React.ReactNode
  sidebar: React.ReactNode
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-3 lg:pb-0">
      <div className="space-y-4 lg:col-span-2">{body}</div>
      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">{sidebar}</aside>
    </div>
  )
}

export function BookingSidebar({
  children,
  totalPax,
  totalCents,
  currency,
  isQuoting,
  quoteData,
  disabled,
  onBook,
}: {
  children: React.ReactNode
  totalPax: number
  totalCents: number
  currency: string | undefined
  isQuoting: boolean
  quoteData: { available?: boolean; invalidReason?: string } | null | undefined
  disabled: boolean
  onBook: () => void
}): React.ReactElement {
  const priceLabel =
    totalCents > 0 && currency
      ? `from ${formatMoney(totalCents, currency)}`
      : quoteData?.invalidReason
        ? "—"
        : "Pending"

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Book this</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {totalPax} {totalPax === 1 ? "guest" : "guests"}
            </span>
            {isQuoting && !quoteData ? <Skeleton className="h-4 w-20" /> : null}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Subtotal</span>
            <span className="font-medium text-xl">{priceLabel}</span>
          </div>
          {quoteData?.invalidReason ? (
            <p className="text-amber-600 text-xs">
              {humanizeInvalidReason(quoteData.invalidReason)}
            </p>
          ) : null}
          <Button type="button" className="w-full" disabled={disabled} onClick={onBook}>
            Book
          </Button>
          <p className="text-muted-foreground text-xs">
            You won't be charged yet. The next step collects traveler details.
          </p>
        </CardContent>
      </Card>

      {/* Mobile fixed bottom panel — collapses sidebar on narrow viewports */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3 shadow-lg lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-muted-foreground text-xs">
              {totalPax} {totalPax === 1 ? "guest" : "guests"}
            </div>
            <div className="font-medium">{priceLabel}</div>
          </div>
          <Button type="button" disabled={disabled} onClick={onBook}>
            Book
          </Button>
        </div>
      </div>
    </>
  )
}

export function DepartureSelect({
  slots,
  isLoading,
  isError,
  value,
  onChange,
}: {
  slots: ReadonlyArray<AvailabilitySlot>
  isLoading: boolean
  isError: boolean
  value: string | undefined
  onChange: (id: string) => void
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <Label htmlFor="departure-select">Departure</Label>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : isError ? (
        <p className="text-destructive text-sm">Departures unavailable.</p>
      ) : slots.length === 0 ? (
        <p className="text-muted-foreground text-sm">No upcoming departures.</p>
      ) : (
        <select
          id="departure-select"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {formatSlotLabel(slot)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export function PaxBlock({
  adult,
  child,
  infant,
  setAdult,
  setChild,
  setInfant,
  showInfants = true,
}: {
  adult: number
  child: number
  infant: number
  setAdult: (n: number) => void
  setChild: (n: number) => void
  setInfant: (n: number) => void
  showInfants?: boolean
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <Label>Travelers</Label>
      <PaxStepper label="Adults" hint="12 yrs+" value={adult} setValue={setAdult} min={1} max={8} />
      <PaxStepper
        label="Children"
        hint="2–11 yrs"
        value={child}
        setValue={setChild}
        min={0}
        max={6}
      />
      {showInfants ? (
        <PaxStepper
          label="Infants"
          hint="under 2"
          value={infant}
          setValue={setInfant}
          min={0}
          max={4}
        />
      ) : null}
    </div>
  )
}

export function PaxStepper({
  label,
  hint,
  value,
  setValue,
  min,
  max,
}: {
  label: string
  hint: string
  value: number
  setValue: (n: number) => void
  min: number
  max: number
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-muted-foreground text-xs">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value <= min}
          onClick={() => setValue(value - 1)}
        >
          −
        </Button>
        <span className="min-w-6 text-center">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value >= max}
          onClick={() => setValue(value + 1)}
        >
          +
        </Button>
      </div>
    </div>
  )
}

export function ContentResolutionHint({
  resolution,
}: {
  resolution: ContentResolution | null
}): React.ReactElement | null {
  if (!resolution) return null
  const hints: string[] = []
  if (resolution.match_kind && resolution.match_kind !== "exact" && resolution.served_locale) {
    hints.push(`Served in ${resolution.served_locale}`)
  }
  if (resolution.machine_translated) {
    hints.push("Machine-translated")
  }
  if (resolution.source === "synthesized") {
    hints.push("Limited content available")
  }
  if (resolution.served_stale) {
    hints.push("Refreshing in the background")
  }
  if (hints.length === 0) return null
  return <div className="text-muted-foreground text-xs">{hints.join(" · ")}</div>
}

export function HeroImage({ url, alt }: { url: string; alt: string }): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-lg border">
      <img src={url} alt={alt} className="aspect-[16/9] w-full object-cover" />
    </div>
  )
}

export function BackLink(): React.ReactElement {
  return (
    <p>
      <Link to="/shop" className="text-sm underline">
        ← Back to all
      </Link>
    </p>
  )
}

export function BodySkeleton(): React.ReactElement {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}

export function BodyMissing({
  entityModule,
  entityId,
}: {
  entityModule: string
  entityId: string
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {entityModule} · {entityId}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-muted-foreground text-sm">
        <p>Detail content isn't available for this item yet.</p>
        <BackLink />
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

export function formatSlotLabel(slot: AvailabilitySlot): string {
  const date = new Date(slot.startsAt)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  const duration = slot.nights ? ` · ${slot.nights}n` : slot.days ? ` · ${slot.days}d` : ""
  const capacity = slot.unlimited
    ? ""
    : slot.remainingPax != null
      ? ` · ${slot.remainingPax} left`
      : ""
  return `${dateStr} ${time}${duration}${capacity}`
}

export function formatSailingDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function humanizeInvalidReason(reason: string): string {
  switch (reason) {
    case "unavailable":
      return "This product is currently unavailable."
    case "departure_not_found":
      return "This departure is no longer available. Choose another departure."
    case "departure_unavailable":
      return "This departure is sold out or closed. Choose another departure."
    case "no_sell_amount_configured":
      return "Pricing isn't configured for this item yet."
    case "product_not_found":
      return "Product not found."
    case "cruise_not_found":
      return "Cruise not found."
    case "property_not_found":
      return "Property not found."
    case "no_price_for_occupancy":
      return "No price for the chosen cabin and occupancy."
    default:
      return reason
  }
}
