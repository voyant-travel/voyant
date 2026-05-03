"use client"

import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router"
import { type BookingDraftV1, bookingDraftV1 } from "@voyantjs/catalog/booking-engine"
import { useBookingQuote } from "@voyantjs/catalog-react/booking-engine"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Label } from "@voyantjs/ui/components/label"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { useEffect, useMemo, useState } from "react"

import { getApiUrl } from "@/lib/env"

/**
 * Product detail page — the entry point into the booking journey.
 * Modeled on the protravel / luxufe production patterns:
 *
 * 1. Pick the departure here, BEFORE entering the journey. Real
 *    available slots from `/v1/public/catalog/slots` rendered as a
 *    `<select>` (not a free-form date picker).
 * 2. Pick pax counts here (per-band steppers).
 * 3. See live pricing in the sidebar via the same `useBookingQuote`
 *    the journey uses.
 * 4. Click "Book" — the journey route receives the locked-in
 *    departure + pax via search params and skips its Configure
 *    step.
 *
 * The journey itself becomes a 4-step wizard (Travelers → Add-ons →
 * Payment → Review) instead of 7. Configure has already happened.
 */
export const Route = createFileRoute("/(storefront)/shop_/products/$entityModule/$entityId")({
  component: ProductDetailPage,
})

interface AvailabilitySlot {
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

function ProductDetailPage(): React.ReactElement {
  const { entityModule, entityId } = useParams({
    from: "/(storefront)/shop_/products/$entityModule/$entityId",
  })
  const navigate = useNavigate()

  const slots = useQuery({
    queryKey: ["public-catalog-slots", entityModule, entityId],
    queryFn: async (): Promise<{ rows: AvailabilitySlot[] }> => {
      const res = await fetch(
        `${getApiUrl()}/v1/public/catalog/slots?entityModule=${encodeURIComponent(entityModule)}&entityId=${encodeURIComponent(entityId)}`,
        { credentials: "include" },
      )
      if (!res.ok) throw new Error(`Slots request failed: ${res.status}`)
      return res.json()
    },
    staleTime: 30_000,
  })

  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined)
  const [adultCount, setAdultCount] = useState(2)
  const [childCount, setChildCount] = useState(0)
  const [infantCount, setInfantCount] = useState(0)

  // Auto-pick the first open slot when the list loads.
  const firstOpenId = slots.data?.rows[0]?.id
  useEffect(() => {
    if (firstOpenId && !selectedSlotId) setSelectedSlotId(firstOpenId)
  }, [firstOpenId, selectedSlotId])

  // Build a probe draft so we can ask the engine for the live total
  // before the user enters the journey. Uses the same hook the
  // journey shell uses so pricing math is identical.
  const probeDraft = useMemo<BookingDraftV1 | null>(() => {
    if (!selectedSlotId) return null
    return bookingDraftV1.parse({
      entity: { module: entityModule, id: entityId, sourceKind: "" },
      configure: {
        departureSlotId: selectedSlotId,
        pax: { adult: adultCount, child: childCount, infant: infantCount },
      },
    })
  }, [entityModule, entityId, selectedSlotId, adultCount, childCount, infantCount])

  const quote = useBookingQuote({
    surface: "public",
    draft: probeDraft,
  })

  const onBook = () => {
    if (!selectedSlotId) return
    navigate({
      to: "/shop/book/$entityModule/$entityId",
      params: { entityModule, entityId },
      search: {
        departureSlotId: selectedSlotId,
        adult: adultCount,
        ...(childCount > 0 ? { child: childCount } : {}),
        ...(infantCount > 0 ? { infant: infantCount } : {}),
      } as never,
    })
  }

  const totalPax = adultCount + childCount + infantCount
  const totalCents = quote.data?.pricing?.total ?? 0
  const currency = quote.data?.pricing?.currency

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {entityModule === "products" ? "Tour" : entityModule} · {entityId}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Detail content — itinerary, photos, reviews, policies — lives here. For the
              dual-surface validation we focus on the booking primitives; production deployments
              read the rich content from <code>/v1/public/catalog/content</code>.
            </p>
            <p>
              <Link to="/shop" className="underline">
                ← Back to all
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <Card>
          <CardHeader>
            <CardTitle>Book this</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="departure-select">Departure</Label>
              {slots.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : slots.isError || !slots.data ? (
                <p className="text-destructive text-sm">Departures unavailable.</p>
              ) : slots.data.rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No upcoming departures. Check back later.
                </p>
              ) : (
                <select
                  id="departure-select"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedSlotId ?? ""}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                >
                  {slots.data.rows.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {formatSlotLabel(slot)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <Label>Travelers</Label>
              <PaxStepper
                label="Adults"
                hint="12 yrs+"
                value={adultCount}
                setValue={setAdultCount}
                min={1}
                max={8}
              />
              <PaxStepper
                label="Children"
                hint="2–11 yrs"
                value={childCount}
                setValue={setChildCount}
                min={0}
                max={6}
              />
              <PaxStepper
                label="Infants"
                hint="under 2"
                value={infantCount}
                setValue={setInfantCount}
                min={0}
                max={4}
              />
            </div>

            <div className="space-y-1 border-t pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {totalPax} {totalPax === 1 ? "guest" : "guests"}
                </span>
                {quote.isQuoting && !quote.data ? <Skeleton className="h-4 w-20" /> : null}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Total</span>
                <span className="font-medium text-xl">
                  {totalCents > 0 && currency
                    ? formatMoney(totalCents, currency)
                    : quote.data?.invalidReason
                      ? "—"
                      : "Pending"}
                </span>
              </div>
              {quote.data?.invalidReason ? (
                <p className="text-amber-600 text-xs">
                  {humanizeInvalidReason(quote.data.invalidReason)}
                </p>
              ) : null}
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={!selectedSlotId || totalPax < 1 || quote.data?.available === false}
              onClick={onBook}
            >
              Book
            </Button>
            <p className="text-muted-foreground text-xs">
              You won't be charged yet. The next step collects traveler details.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function PaxStepper({
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

function formatSlotLabel(slot: AvailabilitySlot): string {
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

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function humanizeInvalidReason(reason: string): string {
  switch (reason) {
    case "no_sell_amount_configured":
      return "Pricing isn't configured for this product yet."
    case "product_not_found":
      return "Product not found."
    default:
      return reason
  }
}
