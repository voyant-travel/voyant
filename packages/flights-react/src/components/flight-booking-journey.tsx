"use client"

import type {
  FlightBookRequest,
  FlightOffer,
  FlightOrder,
  FlightPassenger,
  PassengerCounts,
  PaymentIntent,
} from "@voyant-travel/flights/contract/types"
import { Button } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useFlightsUiI18nOrDefault } from "../i18n/index.js"
import {
  FlightContactForm,
  type FlightContactValue,
  validateContact,
} from "./flight-contact-form.js"
import { FlightOfferDetail } from "./flight-offer-detail.js"
import {
  FlightPassengerForm,
  type FlightPassengerFormProps,
  validatePassengers,
} from "./flight-passenger-form.js"
import { FlightPaymentSelector } from "./flight-payment-selector.js"

type StepId = "review" | "passengers" | "contact" | "confirm"

const STEPS: ReadonlyArray<{ id: StepId }> = [
  { id: "review" },
  { id: "passengers" },
  { id: "contact" },
  { id: "confirm" },
]

export interface FlightBookingJourneyProps {
  /** The offer to book — usually returned by the priceOffer call. */
  offer: FlightOffer
  /** Passenger counts captured at search time. */
  passengers: PassengerCounts
  /** Submit handler — wire to the useFlightBook mutation. */
  onBook: (request: FlightBookRequest) => Promise<FlightOrder> | FlightOrder
  /** Surfaced via book result; parent typically navigates to /orders/:id. */
  onBooked?: (order: FlightOrder) => void
  /** "Back to results" affordance. */
  onCancel?: () => void
  /** Optional formatter so passenger card shows airline/airport names. */
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  /**
   * Optional render slot for a person picker on each passenger card.
   * Forwarded to `FlightPassengerForm.renderPicker` — operators wire a
   * CRM-aware picker here so users can pick existing contacts as travelers.
   */
  renderPassengerPicker?: FlightPassengerFormProps["renderPicker"]
}

/**
 * Multi-step booking journey: Review → Passengers → Contact + Payment →
 * Confirm. Owns the in-progress form state; submits via `onBook` on the
 * final step. Each step gates Continue with its own validator so the user
 * can't advance with incomplete data.
 */
export function FlightBookingJourney({
  offer,
  passengers,
  onBook,
  onBooked,
  onCancel,
  carrierName,
  airportName,
  renderPassengerPicker,
}: FlightBookingJourneyProps) {
  const i18n = useFlightsUiI18nOrDefault()
  const messages = i18n.messages.flightBookingJourney
  const [stepIdx, setStepIdx] = useState(0)
  const [paxList, setPaxList] = useState<FlightPassenger[]>([])
  const [contact, setContact] = useState<FlightContactValue>({})
  const [payment, setPayment] = useState<PaymentIntent>({ type: "hold" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step = STEPS[stepIdx]
  if (!step) return null

  const paxErrors = validatePassengers(paxList)
  const contactError = validateContact(contact)

  const canContinue = (() => {
    switch (step.id) {
      case "review":
        return true
      case "passengers":
        return Object.keys(paxErrors).length === 0 && paxList.length > 0
      case "contact":
        return contactError == null
      case "confirm":
        return true
    }
  })()

  const goNext = () => {
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))
  }
  const goBack = () => {
    setStepIdx((i) => Math.max(0, i - 1))
  }

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const order = await onBook({
        offerId: offer.offerId,
        offer,
        passengers: paxList,
        contact,
        paymentIntent: payment,
      })
      onBooked?.(order)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper currentIdx={stepIdx} messages={messages.steps} />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {step.id === "review" && (
          <div className="rounded-md border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">{messages.reviewTitle}</h2>
            <FlightOfferDetail offer={offer} carrierName={carrierName} airportName={airportName} />
          </div>
        )}

        {step.id === "passengers" && (
          <FlightPassengerForm
            counts={passengers}
            value={paxList}
            onChange={setPaxList}
            renderPicker={renderPassengerPicker}
          />
        )}

        {step.id === "contact" && (
          <>
            <FlightContactForm value={contact} onChange={setContact} />
            <FlightPaymentSelector value={payment} onChange={setPayment} />
          </>
        )}

        {step.id === "confirm" && (
          <ConfirmSummary
            offer={offer}
            passengers={paxList}
            contact={contact}
            payment={payment}
            i18n={i18n}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (stepIdx === 0 ? onCancel?.() : goBack())}
          disabled={submitting}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {stepIdx === 0 ? messages.backToResults : messages.back}
        </Button>
        {step.id === "confirm" ? (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? messages.booking : messages.confirmBooking}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!canContinue}>
            {messages.continue}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper indicator
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({
  currentIdx,
  messages,
}: {
  currentIdx: number
  messages: ReturnType<
    typeof useFlightsUiI18nOrDefault
  >["messages"]["flightBookingJourney"]["steps"]
}) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const isActive = i === currentIdx
        const isComplete = i < currentIdx
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                isComplete && "border-primary bg-primary text-primary-foreground",
                isActive && !isComplete && "border-primary text-primary",
                !isActive && !isComplete && "border-border text-muted-foreground",
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "truncate text-sm",
                isActive ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {messages[s.id]}
            </span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Final confirmation summary
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmSummary({
  offer,
  passengers,
  contact,
  payment,
  i18n,
}: {
  offer: FlightOffer
  passengers: FlightPassenger[]
  contact: FlightContactValue
  payment: PaymentIntent
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>
}) {
  const messages = i18n.messages.flightBookingJourney
  return (
    <div className="rounded-md border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">{messages.confirmBooking}</h2>

      <Row label={messages.rows.total}>
        <span className="font-semibold tabular-nums">
          {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency, i18n)}
        </span>
      </Row>
      <Row label={messages.rows.passengers}>{passengers.length}</Row>
      <Row label={messages.rows.contact}>{contact.email ?? i18n.messages.common.noValue}</Row>
      <Row label={messages.rows.payment}>
        <span>{i18n.messages.flightPaymentSelector.intents[payment.type].title}</span>
      </Row>
      {offer.expiresAt && (
        <Row label={messages.rows.offerExpires}>
          <time dateTime={offer.expiresAt}>{i18n.formatDateTime(offer.expiresAt)}</time>
        </Row>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{messages.confirmDescription}</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  )
}

function formatMoney(
  amount: string,
  currency: string,
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>,
): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return i18n.formatCurrency(n, currency, { maximumFractionDigits: 0 })
}
