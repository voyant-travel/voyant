"use client"

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
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"

import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"

export interface PricingBasis {
  base_amount: number
  taxes?: number
  fees?: number
  surcharges?: number
  currency: string
}

export interface CatalogQuoteResponse {
  quoteId: string
  quotedAt: string
  expiresAt: string
  available: boolean
  invalidReason?: string
  pricing?: PricingBasis
  upstreamPayload?: Record<string, unknown>
}

export interface CatalogBookResponse {
  bookingId: string
  orderRef: string
  status: "held" | "confirmed" | "ticketed" | "failed"
  snapshotId: string
  pricing?: PricingBasis
}

export interface CatalogBookingRouteState {
  entityModule: string
  entityId: string
  sourceKind: string
  sourceRef?: string
  name?: string
  supplierId?: string
  locale?: string
  departureId?: string
  departureStartsAt?: string
}

export interface ContactValue {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface TravelerEntry {
  rowId: string
  firstName: string
  lastName: string
  email: string
}

export type PaymentIntentKind = "hold" | "card"

export interface CatalogQuoteRequest {
  entityModule: string
  entityId: string
  sourceKind: string
  sourceRef?: string
  scope: {
    locale: string
    audience: "staff" | "customer" | "partner" | string
    market: string
  }
  parameters?: Record<string, unknown>
}

export interface CatalogBookRequest {
  quoteId: string
  party: {
    contact: ContactValue
    travelers: TravelerEntry[]
    notes?: string
  }
  parameters: Record<string, unknown>
  paymentIntent: { type: PaymentIntentKind }
}

export interface CatalogBookingFetchers {
  quote: (request: CatalogQuoteRequest) => Promise<CatalogQuoteResponse>
  book: (request: CatalogBookRequest) => Promise<CatalogBookResponse>
}

export interface CatalogBookingFetchersOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
  credentials?: RequestCredentials
}

export interface ContactPickerRenderProps {
  value: ContactValue
  onPick: (value: Partial<ContactValue>) => void
  onAddContact?: () => void
}

export interface CatalogBookingPageProps {
  route: CatalogBookingRouteState
  fetchers: CatalogBookingFetchers
  onBackToCatalog?: () => void
  onCancel?: () => void
  onBookingSuccess?: (booking: CatalogBookResponse) => void
  onBookingError?: (message: string) => void
  onAddContact?: () => void
  renderContactPicker?: (props: ContactPickerRenderProps) => ReactNode
  className?: string
}

interface ErrorResponse {
  error?: string
  code?: string
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

export function CatalogBookingPage({
  route,
  fetchers,
  onBackToCatalog,
  onCancel,
  onBookingSuccess,
  onBookingError,
  onAddContact,
  renderContactPicker,
  className,
}: CatalogBookingPageProps) {
  const messages = useCatalogUiMessagesOrDefault().catalogBookingPage
  const [quote, setQuote] = useState<CatalogQuoteResponse | null>(null)
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
      const res = await fetchers.quote({
        entityModule: route.entityModule,
        entityId: route.entityId,
        sourceKind: route.sourceKind,
        sourceRef: route.sourceRef,
        scope: {
          locale: route.locale ?? "en-GB",
          audience: "staff",
          market: "default",
        },
        parameters: route.departureId ? { departure_id: route.departureId } : undefined,
      })
      setQuote(res)
    } catch (err) {
      setQuote(null)
      setQuoteError(err instanceof Error ? err.message : String(err))
    } finally {
      setQuoteLoading(false)
    }
  }, [fetchers, route])

  useEffect(() => {
    void refreshQuote()
  }, [refreshQuote])

  const validation = useMemo<string | null>(() => {
    if (!quote) return messages.validation.waitingForPrice
    if (!quote.available) return quote.invalidReason ?? messages.validation.notBookable
    if (!contact.firstName.trim() || !contact.lastName.trim()) {
      return messages.validation.contactNameRequired
    }
    if (!contact.email.trim()) return messages.validation.contactEmailRequired
    const empty = travelers.findIndex((t) => !t.firstName.trim() || !t.lastName.trim())
    if (empty !== -1)
      return messages.validation.travelerNameRequired.replace("{n}", String(empty + 1))
    return null
  }, [quote, contact, travelers, messages])

  const onBook = async () => {
    if (validation || !quote) return
    setSubmitting(true)
    try {
      const booking = await fetchers.book({
        quoteId: quote.quoteId,
        party: {
          contact,
          travelers,
          notes: notes.trim() || undefined,
        },
        parameters: {
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(route.departureId ? { departure_id: route.departureId } : {}),
        },
        paymentIntent: { type: paymentIntent },
      })
      onBookingSuccess?.(booking)
    } catch (err) {
      onBookingError?.(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={className ?? "mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6 lg:px-8"}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">{messages.title}</h1>
          <p className="text-muted-foreground text-sm">
            {messages.descriptionPrefix}{" "}
            <span className="font-medium text-foreground">{route.name ?? route.entityId}</span>.
          </p>
        </div>
        {onBackToCatalog && (
          <Button variant="ghost" onClick={onBackToCatalog}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {messages.actions.backToCatalog}
          </Button>
        )}
      </header>

      <SourcedEntitySummary
        name={route.name}
        entityModule={route.entityModule}
        sourceKind={route.sourceKind}
        supplierId={route.supplierId}
        departureStartsAt={route.departureStartsAt}
        quote={quote}
        quoteLoading={quoteLoading}
        quoteError={quoteError}
        onRefresh={() => void refreshQuote()}
      />

      <ContactSection
        value={contact}
        onChange={setContact}
        onAddContact={onAddContact}
        renderContactPicker={renderContactPicker}
      />

      <TravelersSection value={travelers} onChange={setTravelers} />
      <NotesSection value={notes} onChange={setNotes} />
      <PaymentSection value={paymentIntent} onChange={setPaymentIntent} />
      <ReviewFooter
        quote={quote}
        validation={validation}
        submitting={submitting}
        onBook={onBook}
        onCancel={onCancel ?? onBackToCatalog}
      />
    </div>
  )
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
}: {
  name: string | undefined
  entityModule: string
  sourceKind: string
  supplierId: string | undefined
  departureStartsAt: string | undefined
  quote: CatalogQuoteResponse | null
  quoteLoading: boolean
  quoteError: string | null
  onRefresh: () => void
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogBookingPage
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
          <h2 className="mt-2 truncate font-semibold text-lg">
            {name ?? messages.summary.untitled}
          </h2>
          {departureStartsAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.summary.departure} ·{" "}
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
          {messages.actions.refreshPrice}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat
          label={messages.summary.available}
          value={
            quoteLoading
              ? messages.values.loading
              : quote == null
                ? messages.values.empty
                : quote.available
                  ? messages.values.yes
                  : (quote.invalidReason ?? messages.values.no)
          }
          tone={
            quoteLoading || quote == null ? "muted" : quote.available ? "success" : "destructive"
          }
        />
        <SummaryStat
          label={messages.summary.livePrice}
          value={
            quoteLoading
              ? messages.values.loading
              : quote?.pricing
                ? formatPrice(quote.pricing)
                : messages.values.empty
          }
        />
        <SummaryStat
          label={messages.summary.quoteExpires}
          value={
            quoteLoading
              ? messages.values.loading
              : quote
                ? new Date(quote.expiresAt).toLocaleTimeString()
                : messages.values.empty
          }
        />
      </div>

      {quoteError && (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {messages.summary.quoteFailed}: {quoteError}
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

function ContactSection({
  value,
  onChange,
  onAddContact,
  renderContactPicker,
}: {
  value: ContactValue
  onChange: (v: ContactValue) => void
  onAddContact?: () => void
  renderContactPicker?: (props: ContactPickerRenderProps) => ReactNode
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogBookingPage
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-base">{messages.contact.title}</h2>
          <p className="text-muted-foreground text-sm">{messages.contact.description}</p>
        </div>
        {renderContactPicker?.({
          value,
          onPick: (prefill) =>
            onChange({
              firstName: prefill.firstName ?? value.firstName,
              lastName: prefill.lastName ?? value.lastName,
              email: prefill.email ?? value.email,
              phone: prefill.phone ?? value.phone,
            }),
          onAddContact,
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={messages.contact.firstName} required>
          <Input
            value={value.firstName}
            onChange={(e) => onChange({ ...value, firstName: e.target.value })}
            placeholder={messages.contact.firstNamePlaceholder}
          />
        </Field>
        <Field label={messages.contact.lastName} required>
          <Input
            value={value.lastName}
            onChange={(e) => onChange({ ...value, lastName: e.target.value })}
            placeholder={messages.contact.lastNamePlaceholder}
          />
        </Field>
        <Field label={messages.contact.email} required>
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder={messages.contact.emailPlaceholder}
          />
        </Field>
        <Field label={messages.contact.phone}>
          <PhoneInput
            international
            value={value.phone || undefined}
            onChange={(v) => onChange({ ...value, phone: v ?? "" })}
            placeholder={messages.contact.phonePlaceholder}
          />
        </Field>
      </div>
    </section>
  )
}

function TravelersSection({
  value,
  onChange,
}: {
  value: TravelerEntry[]
  onChange: (v: TravelerEntry[]) => void
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogBookingPage
  const updateAt = (i: number, patch: Partial<TravelerEntry>) => {
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-base">{messages.travelers.title}</h2>
          <p className="text-muted-foreground text-sm">{messages.travelers.description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, blankTraveler()])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {messages.actions.addTraveler}
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {value.map((t, i) => (
          <div
            key={t.rowId}
            className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Field
              label={messages.travelers.firstNameLabel.replace("{n}", String(i + 1))}
              required
              hideLabel
            >
              <Input
                value={t.firstName}
                onChange={(e) => updateAt(i, { firstName: e.target.value })}
                placeholder={messages.travelers.firstNamePlaceholder.replace("{n}", String(i + 1))}
              />
            </Field>
            <Field
              label={messages.travelers.lastNameLabel.replace("{n}", String(i + 1))}
              required
              hideLabel
            >
              <Input
                value={t.lastName}
                onChange={(e) => updateAt(i, { lastName: e.target.value })}
                placeholder={messages.travelers.lastNamePlaceholder}
              />
            </Field>
            <Field label={messages.travelers.emailLabel.replace("{n}", String(i + 1))} hideLabel>
              <Input
                type="email"
                value={t.email}
                onChange={(e) => updateAt(i, { email: e.target.value })}
                placeholder={messages.travelers.emailPlaceholder}
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              disabled={value.length <= 1}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label={messages.actions.removeTraveler.replace("{n}", String(i + 1))}
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
  const messages = useCatalogUiMessagesOrDefault().catalogBookingPage
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-medium text-base">{messages.notes.title}</h2>
      <p className="text-muted-foreground text-sm">{messages.notes.description}</p>
      <Textarea
        className="mt-3"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={messages.notes.placeholder}
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
  const messages = useCatalogUiMessagesOrDefault().catalogBookingPage
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-medium text-base">{messages.payment.title}</h2>
      <p className="text-muted-foreground text-sm">{messages.payment.description}</p>
      <div className="mt-3 max-w-sm">
        <Label htmlFor="catalog-payment-intent">{messages.payment.intent}</Label>
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
            <SelectItem value="hold">{messages.payment.hold}</SelectItem>
            <SelectItem value="card" disabled>
              {messages.payment.cardComingSoon}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}

function ReviewFooter({
  quote,
  validation,
  submitting,
  onBook,
  onCancel,
}: {
  quote: CatalogQuoteResponse | null
  validation: string | null
  submitting: boolean
  onBook: () => void
  onCancel?: () => void
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogBookingPage
  return (
    <section className="sticky bottom-4 z-10 rounded-xl border bg-card p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            {messages.review.total}
          </span>
          <span className="font-semibold text-xl">
            {quote?.pricing ? formatPrice(quote.pricing) : messages.values.empty}
          </span>
          {validation && <span className="mt-1 text-destructive text-xs">{validation}</span>}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              {messages.actions.cancel}
            </Button>
          )}
          <Button onClick={onBook} disabled={submitting || validation != null} className="min-w-32">
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {messages.actions.booking}
              </>
            ) : (
              messages.actions.confirmBooking
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

function Field({
  label,
  required,
  hideLabel,
  children,
}: {
  label: string
  required?: boolean
  hideLabel?: boolean
  children: ReactNode
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
  const value = pricing.base_amount >= 100 ? pricing.base_amount / 100 : pricing.base_amount
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: pricing.currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function createCatalogBookingFetchers({
  baseUrl,
  fetch: fetchImpl = globalThis.fetch,
  credentials = "include",
}: CatalogBookingFetchersOptions): CatalogBookingFetchers {
  const postJson = async <T,>(path: string, body: unknown): Promise<T> => {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials,
    })
    const json = (await res.json()) as T | ErrorResponse
    const error =
      typeof json === "object" && json != null && "error" in json ? json.error : undefined
    if (!res.ok || error) {
      throw new Error(error || res.statusText)
    }
    return json as T
  }
  return {
    quote: (request) => postJson<CatalogQuoteResponse>("/v1/admin/catalog/quote", request),
    book: (request) => postJson<CatalogBookResponse>("/v1/admin/catalog/book", request),
  }
}
