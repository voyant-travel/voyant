"use client"

import type {
  FlightBookRequest,
  FlightOffer,
  FlightOrder,
  FlightPassenger,
  PassengerCounts,
  PaymentIntent,
} from "@voyantjs/flights/contract/types"
import { Button } from "@voyantjs/ui/components/button"
import { cn } from "@voyantjs/ui/lib/utils"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

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

const STEPS: ReadonlyArray<{ id: StepId; label: string }> = [
  { id: "review", label: "Review offer" },
  { id: "passengers", label: "Passengers" },
  { id: "contact", label: "Contact & payment" },
  { id: "confirm", label: "Confirm" },
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
      <Stepper currentIdx={stepIdx} />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {step.id === "review" && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">Review your selected flight</h2>
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
          <ConfirmSummary offer={offer} passengers={paxList} contact={contact} payment={payment} />
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
          {stepIdx === 0 ? "Back to results" : "Back"}
        </Button>
        {step.id === "confirm" ? (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Booking…" : "Confirm booking"}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!canContinue}>
            Continue
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

function Stepper({ currentIdx }: { currentIdx: number }) {
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
              {s.label}
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
}: {
  offer: FlightOffer
  passengers: FlightPassenger[]
  contact: FlightContactValue
  payment: PaymentIntent
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">Confirm booking</h2>

      <Row label="Total">
        <span className="font-semibold tabular-nums">
          {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency)}
        </span>
      </Row>
      <Row label="Passengers">{passengers.length}</Row>
      <Row label="Contact">{contact.email ?? "—"}</Row>
      <Row label="Payment">
        <span className="capitalize">{payment.type.replace("_", " ")}</span>
      </Row>
      {offer.expiresAt && (
        <Row label="Offer expires">
          <time dateTime={offer.expiresAt}>{formatDateTime(offer.expiresAt)}</time>
        </Row>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Submitting will hold seats with the connector and (depending on the chosen payment intent)
        either issue tickets immediately or open a ticketing window. Once confirmed, the booking
        appears under the order id below.
      </p>
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

function formatMoney(amount: string, currency: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}
