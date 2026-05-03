"use client"

/**
 * Multi-step catalog booking journey for sourced inventory.
 *
 * Rough analog of `templates/operator/src/components/voyant/flights/flight-booking-page.tsx`:
 *
 *   1. **Quote** — call POST /v1/admin/catalog/quote on mount, refresh on
 *      demand. Surface invalidReason / unavailability inline.
 *   2. **Lead contact** — name + email + phone, with a CRM "pick from
 *      contacts" affordance (re-uses the flight booking page's
 *      `PassengerContactPicker`).
 *   3. **Travelers** — variable list, default 1. Just first/last name +
 *      optional email for now; richer fields belong on a per-vertical
 *      passenger schema once a real adapter ships one.
 *   4. **Notes / parameters** — free-form notes echoed into the adapter's
 *      `parameters` payload.
 *   5. **Payment** — `hold` (default) or `card` (gated, until payments
 *      wire in). Mirrors flights' BookingPaymentIntent.
 *   6. **Review + book** — final summary and Book button → POST
 *      /v1/admin/catalog/book → on success, navigate to /orders/catalog.
 *
 * Tracer scope per `docs/architecture/catalog-booking-engine.md` §9 still
 * holds: products vertical only, demo adapter only, single-line bookings,
 * hold-only payment intent. The page's `payment-step` UI shows the card
 * row as disabled with a helpful note rather than a hard removal so the
 * flow makes sense once payments arrive.
 */

import { useNavigate } from "@tanstack/react-router"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { PhoneInput } from "@voyantjs/ui/components/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { ChevronLeft, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PassengerContactPicker } from "@/components/voyant/flights/passenger-contact-picker"
import { getApiUrl } from "@/lib/env"
import { Route } from "@/routes/_workspace/catalog_.book.$entityModule.$entityId"

interface PricingBasis {
  base_amount: number
  taxes?: number
  fees?: number
  surcharges?: number
  currency: string
}

interface QuoteResponse {
  quoteId: string
  quotedAt: string
  expiresAt: string
  available: boolean
  invalidReason?: string
  pricing?: PricingBasis
  upstreamPayload?: Record<string, unknown>
}

interface BookResponse {
  bookingId: string
  orderRef: string
  status: "held" | "confirmed" | "ticketed" | "failed"
  snapshotId: string
  pricing?: PricingBasis
}

interface ErrorResponse {
  error?: string
  code?: string
}

interface ContactValue {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface TravelerEntry {
  /** Stable client-side id for React keys — never sent to the engine. */
  rowId: string
  firstName: string
  lastName: string
  email: string
}

const blankContact = (): ContactValue => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
})
let _travelerRowSeq = 0
const blankTraveler = (): TravelerEntry => ({
  rowId: `t-${++_travelerRowSeq}`,
  firstName: "",
  lastName: "",
  email: "",
})

type PaymentIntentKind = "hold" | "card"

export function CatalogBookingPage() {
  const navigate = useNavigate()
  const params = Route.useParams()
  const search = Route.useSearch()

  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [contact, setContact] = useState<ContactValue>(blankContact)
  const [travelers, setTravelers] = useState<TravelerEntry[]>(() => [blankTraveler()])
  const [notes, setNotes] = useState("")
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentKind>("hold")
  const [submitting, setSubmitting] = useState(false)

  const refreshQuote = useCallback(async () => {
    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const res = await postJson<QuoteResponse | ErrorResponse>("/v1/admin/catalog/quote", {
        entityModule: params.entityModule,
        entityId: params.entityId,
        sourceKind: search.sourceKind,
        sourceRef: search.sourceRef,
        scope: {
          locale: search.locale ?? "en-GB",
          audience: "staff",
          market: "default",
        },
        parameters: search.departureId ? { departure_id: search.departureId } : undefined,
      })
      if ("error" in res && res.error) {
        setQuoteError(res.error)
        setQuote(null)
        return
      }
      setQuote(res as QuoteResponse)
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : String(err))
    } finally {
      setQuoteLoading(false)
    }
  }, [
    params.entityModule,
    params.entityId,
    search.sourceKind,
    search.sourceRef,
    search.locale,
    search.departureId,
  ])

  useEffect(() => {
    void refreshQuote()
  }, [refreshQuote])

  const validation = useMemo<string | null>(() => {
    if (!quote) return "Waiting for live price…"
    if (!quote.available) return quote.invalidReason ?? "This row is no longer bookable."
    if (!contact.firstName.trim() || !contact.lastName.trim()) {
      return "Lead contact: first and last name are required."
    }
    if (!contact.email.trim()) return "Lead contact: email is required."
    const empty = travelers.findIndex((t) => !t.firstName.trim() || !t.lastName.trim())
    if (empty !== -1) return `Traveler #${empty + 1}: first and last name are required.`
    return null
  }, [quote, contact, travelers])

  const onBook = async () => {
    if (validation || !quote) return
    setSubmitting(true)
    try {
      const res = await postJson<BookResponse | ErrorResponse>("/v1/admin/catalog/book", {
        quoteId: quote.quoteId,
        party: {
          contact,
          travelers,
          notes: notes.trim() || undefined,
        },
        parameters: {
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(search.departureId ? { departure_id: search.departureId } : {}),
        },
        paymentIntent: { type: paymentIntent },
      })
      if ("error" in res && res.error) {
        toast.error(`Book failed: ${res.error}`)
        return
      }
      const b = res as BookResponse
      toast.success(`Booked — order ${b.orderRef.slice(0, 16)}… (${b.status})`, {
        action: {
          label: "View orders",
          onClick: () => navigate({ to: "/orders/catalog" }),
        },
      })
      navigate({ to: "/orders/catalog" })
    } catch (err) {
      toast.error(`Book request failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">Book this row</h1>
          <p className="text-muted-foreground text-sm">
            Confirm contact, travelers and payment to commit a booking against{" "}
            <span className="font-medium text-foreground">{search.name ?? params.entityId}</span>.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate({ to: "/catalog" })}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to catalog
        </Button>
      </header>

      <SourcedEntitySummary
        name={search.name}
        entityModule={params.entityModule}
        sourceKind={search.sourceKind}
        supplierId={search.supplierId}
        departureStartsAt={search.departureStartsAt}
        quote={quote}
        quoteLoading={quoteLoading}
        quoteError={quoteError}
        onRefresh={() => void refreshQuote()}
      />

      <ContactSection value={contact} onChange={setContact} />

      <TravelersSection value={travelers} onChange={setTravelers} />

      <NotesSection value={notes} onChange={setNotes} />

      <PaymentSection value={paymentIntent} onChange={setPaymentIntent} />

      <ReviewFooter
        quote={quote}
        validation={validation}
        submitting={submitting}
        onBook={onBook}
        onCancel={() => navigate({ to: "/catalog" })}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

interface SourcedEntitySummaryProps {
  name: string | undefined
  entityModule: string
  sourceKind: string
  supplierId: string | undefined
  departureStartsAt: string | undefined
  quote: QuoteResponse | null
  quoteLoading: boolean
  quoteError: string | null
  onRefresh: () => void
}

function SourcedEntitySummary({
  name,
  entityModule,
  sourceKind,
  supplierId,
  departureStartsAt,
  quote,
  quoteLoading,
  quoteError,
  onRefresh,
}: SourcedEntitySummaryProps) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={sourceKind === "owned" ? "secondary" : "outline"} className="text-xs">
              {sourceKind}
            </Badge>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              {entityModule}
            </span>
            {supplierId && <span className="text-muted-foreground text-xs">· {supplierId}</span>}
          </div>
          <h2 className="mt-2 truncate font-semibold text-lg">{name ?? "Untitled row"}</h2>
          {departureStartsAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Departure ·{" "}
              <span className="font-medium text-foreground">
                {formatDepartureLabel(departureStartsAt)}
              </span>
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={quoteLoading}>
          {quoteLoading ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          )}
          Refresh price
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Available"
          value={
            quoteLoading
              ? "…"
              : quote == null
                ? "—"
                : quote.available
                  ? "Yes"
                  : (quote.invalidReason ?? "No")
          }
          tone={
            quoteLoading || quote == null ? "muted" : quote.available ? "success" : "destructive"
          }
        />
        <SummaryStat
          label="Live price"
          value={quoteLoading ? "…" : quote?.pricing ? formatPrice(quote.pricing) : "—"}
        />
        <SummaryStat
          label="Quote expires"
          value={quoteLoading ? "…" : quote ? new Date(quote.expiresAt).toLocaleTimeString() : "—"}
        />
      </div>

      {quoteError && (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
          Quote failed: {quoteError}
        </p>
      )}
    </section>
  )
}

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "muted" | "success" | "destructive"
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground"
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className={`mt-1 truncate font-medium text-sm ${toneClass}`}>{value}</div>
    </div>
  )
}

interface ContactSectionProps {
  value: ContactValue
  onChange: (v: ContactValue) => void
}

function ContactSection({ value, onChange }: ContactSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-base">Lead contact</h2>
          <p className="text-muted-foreground text-sm">
            Who's in charge of the booking. Confirmation emails go here.
          </p>
        </div>
        <PassengerContactPicker
          onPick={(prefill) =>
            onChange({
              firstName: prefill.firstName ?? value.firstName,
              lastName: prefill.lastName ?? value.lastName,
              email: prefill.email ?? value.email,
              phone: prefill.phone ?? value.phone,
            })
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name" required>
          <Input
            value={value.firstName}
            onChange={(e) => onChange({ ...value, firstName: e.target.value })}
            placeholder="Maria"
          />
        </Field>
        <Field label="Last name" required>
          <Input
            value={value.lastName}
            onChange={(e) => onChange({ ...value, lastName: e.target.value })}
            placeholder="Popescu"
          />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="maria@example.com"
          />
        </Field>
        <Field label="Phone">
          <PhoneInput
            international
            value={value.phone || undefined}
            onChange={(v) => onChange({ ...value, phone: v ?? "" })}
            placeholder="+40 7XX XXX XXX"
          />
        </Field>
      </div>
    </section>
  )
}

interface TravelersSectionProps {
  value: TravelerEntry[]
  onChange: (v: TravelerEntry[]) => void
}

function TravelersSection({ value, onChange }: TravelersSectionProps) {
  const updateAt = (i: number, patch: Partial<TravelerEntry>) => {
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-base">Travelers</h2>
          <p className="text-muted-foreground text-sm">
            Who's actually going. Add a row per traveler.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, blankTraveler()])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add traveler
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {value.map((t, i) => (
          <div
            key={t.rowId}
            className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Field label={`Traveler #${i + 1} · first name`} required hideLabel>
              <Input
                value={t.firstName}
                onChange={(e) => updateAt(i, { firstName: e.target.value })}
                placeholder={`Traveler ${i + 1} · first name`}
              />
            </Field>
            <Field label={`Traveler #${i + 1} · last name`} required hideLabel>
              <Input
                value={t.lastName}
                onChange={(e) => updateAt(i, { lastName: e.target.value })}
                placeholder="Last name"
              />
            </Field>
            <Field label={`Traveler #${i + 1} · email`} hideLabel>
              <Input
                type="email"
                value={t.email}
                onChange={(e) => updateAt(i, { email: e.target.value })}
                placeholder="Email (optional)"
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              disabled={value.length <= 1}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label={`Remove traveler ${i + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}

function NotesSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-medium text-base">Notes for the supplier</h2>
      <p className="text-muted-foreground text-sm">
        Optional. Echoed to the adapter's parameters payload — useful for special requests,
        accessibility needs, dietary restrictions.
      </p>
      <Textarea
        className="mt-3"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Vegetarian dinner. Wheelchair access at pickup."
      />
    </section>
  )
}

function PaymentSection({
  value,
  onChange,
}: {
  value: PaymentIntentKind
  onChange: (v: PaymentIntentKind) => void
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-medium text-base">Payment</h2>
      <p className="text-muted-foreground text-sm">
        Choose how this commitment is paid. The booking-engine tracer ships with hold-only; card
        flows arrive once payments are wired through the engine.
      </p>
      <div className="mt-3 max-w-sm">
        <Label htmlFor="catalog-payment-intent">Intent</Label>
        <Select
          value={value}
          onValueChange={(v) => {
            if (v === "hold" || v === "card") onChange(v)
          }}
        >
          <SelectTrigger id="catalog-payment-intent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hold">Hold (pay later)</SelectItem>
            <SelectItem value="card" disabled>
              Card · coming soon
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}

interface ReviewFooterProps {
  quote: QuoteResponse | null
  validation: string | null
  submitting: boolean
  onBook: () => void
  onCancel: () => void
}

function ReviewFooter({ quote, validation, submitting, onBook, onCancel }: ReviewFooterProps) {
  return (
    <section className="sticky bottom-4 z-10 rounded-xl border bg-card p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">Total</span>
          <span className="font-semibold text-xl">
            {quote?.pricing ? formatPrice(quote.pricing) : "—"}
          </span>
          {validation && <span className="mt-1 text-destructive text-xs">{validation}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onBook} disabled={submitting || validation != null} className="min-w-32">
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Booking…
              </>
            ) : (
              "Confirm booking"
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hideLabel,
  children,
}: {
  label: string
  required?: boolean
  hideLabel?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={hideLabel ? "" : "flex flex-col gap-1"}>
      {!hideLabel && (
        <Label className="text-muted-foreground text-xs">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
    </div>
  )
}

function formatDepartureLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function formatPrice(pricing: PricingBasis): string {
  // Engine stores base_amount as cents for the demo adapter (priceCents).
  // Treat values >= 100 as cents (divide by 100); plain decimals stay as-is.
  const value = pricing.base_amount >= 100 ? pricing.base_amount / 100 : pricing.base_amount
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: pricing.currency,
    maximumFractionDigits: 2,
  }).format(value)
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })
  return (await res.json()) as T
}
