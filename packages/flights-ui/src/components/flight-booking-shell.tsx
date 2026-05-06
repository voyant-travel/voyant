"use client"

import type {
  AncillaryCatalog,
  AncillarySelection,
  FlightBookRequest,
  FlightOffer,
  FlightOrder,
  FlightPassenger,
  PassengerCounts,
  PaymentIntent,
  SeatMap,
} from "@voyantjs/flights/contract/types"
import { Button } from "@voyantjs/ui/components/button"
import { cn } from "@voyantjs/ui/lib/utils"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import { FlightBaggageStep } from "./flight-baggage-step.js"
import {
  type BillingValue,
  emptyBillingValue,
  FlightBillingStep,
  validateBilling,
} from "./flight-billing-step.js"
import {
  FlightBookingLedger,
  type FlightItinerarySelection,
  type LedgerLineItem,
} from "./flight-booking-ledger.js"
import { FlightFareUpsellStep } from "./flight-fare-upsell-step.js"
import { FlightItinerary } from "./flight-itinerary.js"
import {
  FlightPassengerForm,
  type FlightPassengerFormProps,
  validatePassengers,
} from "./flight-passenger-form.js"
import {
  FlightPaymentStep,
  type PaymentStepCapabilities,
  type SavedPaymentMethod,
} from "./flight-payment-step.js"
import { type FlightSeatMapSlot, FlightSeatsStep } from "./flight-seats-step.js"
import { FlightServicesStep } from "./flight-services-step.js"

type StepId =
  | "review"
  | "fares"
  | "passengers"
  | "bags"
  | "seats"
  | "services"
  | "billing"
  | "payment"
  | "confirm"

interface StepDef {
  id: StepId
  label: string
}

const ALL_STEPS: ReadonlyArray<StepDef> = [
  { id: "review", label: "Review" },
  { id: "fares", label: "Fare" },
  { id: "passengers", label: "Passengers" },
  { id: "bags", label: "Bags" },
  { id: "seats", label: "Seats" },
  { id: "services", label: "Services" },
  { id: "billing", label: "Billing" },
  { id: "payment", label: "Payment" },
  { id: "confirm", label: "Confirm" },
]

/**
 * Steps that always render — the rest are adapter-capability-gated.
 *   - `fares` shows when the offer surfaces `fareBundles`
 *   - `bags` shows when the ancillary catalog has any baggage options
 *   - `seats` shows when a seat-map fetcher is wired
 *   - `services` shows when the ancillary catalog has assistance OR extras
 *
 * Travel documents live as an opt-in subsection on each passenger card —
 * collapsed by default ("Add at check-in instead"), expanded when the
 * operator wants to capture passport / national-id up front.
 */
const ALWAYS_VISIBLE: ReadonlySet<StepId> = new Set([
  "review",
  "passengers",
  "billing",
  "payment",
  "confirm",
])

/**
 * Per-leg ancillary catalogs supplied by the parent (typically via
 * `useFlightAncillaries(outbound)` + `useFlightAncillaries(return)`).
 * The shell owns the user's picks and merges them into the book request.
 */
export interface FlightBookingAncillaries {
  outboundCatalog: AncillaryCatalog | null
  returnCatalog?: AncillaryCatalog | null
  loading?: boolean
}

/**
 * Seat-map fetcher contract supplied by the parent. The shell calls
 * `getSeatMap` lazily per segment id when the user opens "pick now" mode;
 * the parent typically backs this with `useFlightSeatMap`.
 */
export interface FlightBookingSeatMaps {
  /** Returns the slot for the given segment — typically wraps useFlightSeatMap. */
  getSeatMap: (input: { offerId: string; segmentId: string }) => FlightSeatMapSlot
}

/** Saved-payment-methods slot supplied by the parent (CRM-adjacent in production). */
export interface FlightBookingSavedPaymentMethods {
  methods: SavedPaymentMethod[]
  loading?: boolean
}

export interface FlightBookingShellProps {
  /** Per-leg pick — outbound always present, return only on round-trips. */
  selection: FlightItinerarySelection
  passengers: PassengerCounts
  onBook: (request: FlightBookRequest) => Promise<FlightOrder> | FlightOrder
  onBooked?: (order: FlightOrder) => void
  /** "Back to results" affordance. */
  onCancel?: () => void
  /** Per-leg edit affordances on the ledger — typically navigate back to the search page. */
  onEditOutbound?: () => void
  onEditReturn?: () => void
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  /** Per-leg ancillary catalogs. When omitted the bags + services steps render skeletons. */
  ancillaries?: FlightBookingAncillaries
  /** Per-segment seat-map fetcher. When omitted the seats step still works (skip / auto). */
  seatMaps?: FlightBookingSeatMaps
  /** Saved payment methods on file for the picked contact. */
  savedPaymentMethods?: FlightBookingSavedPaymentMethods
  /**
   * What the active processor + template offer for immediate-charge flows
   * (`chargeSavedCard`, `newCard`). Hold (which generates the shareable
   * payment link) and the agency-credit extra are always available.
   *
   * See `docs/architecture/payments-architecture.md` §Core Rule 7.
   */
  paymentCapabilities?: PaymentStepCapabilities
  /** True when the route requires travel documents (international etc.). */
  documentsRequired?: boolean
  /**
   * Optional render slot for a person picker on each passenger card.
   * Forwarded to `FlightPassengerForm.renderPicker`.
   */
  renderPassengerPicker?: FlightPassengerFormProps["renderPicker"]
  /**
   * Render slot for a CRM person picker in the billing step. Receives an
   * `apply` callback the parent invokes with the prefill payload.
   */
  renderBillingPersonPicker?: (apply: (prefill: Partial<BillingValue>) => void) => React.ReactNode
  /**
   * Render slot for a CRM organization picker in the billing step (Companie tab).
   */
  renderBillingOrgPicker?: (apply: (prefill: Partial<BillingValue>) => void) => React.ReactNode
  /**
   * Called when the user toggles "Save as default" + clicks Continue from
   * billing. Parent may persist back to identity addresses / org.
   */
  onSaveBillingDefaults?: (value: BillingValue) => void
}

/**
 * Multi-step booking shell with a sticky right-rail price ledger and a top
 * stepper. Steps: review → passengers → bags → services → contact+payment
 * → confirm. The shell owns the per-leg `FlightItinerarySelection` plus
 * ancillary picks (baggage / assistance / extras), and synthesizes a
 * combined `FlightOffer` (with both itineraries merged) when `onBook` is
 * called — so the booking adapter sees a single offer with all legs intact.
 */
export function FlightBookingShell({
  selection,
  passengers,
  onBook,
  onBooked,
  onCancel,
  onEditOutbound,
  onEditReturn,
  carrierName,
  airportName,
  ancillaries,
  seatMaps,
  savedPaymentMethods,
  paymentCapabilities,
  documentsRequired,
  renderPassengerPicker,
  renderBillingPersonPicker,
  renderBillingOrgPicker,
  onSaveBillingDefaults,
}: FlightBookingShellProps) {
  const [stepId, setStepId] = useState<StepId>("review")
  const [paxList, setPaxList] = useState<FlightPassenger[]>([])
  const [billing, setBilling] = useState<BillingValue>(emptyBillingValue)
  const [payment, setPayment] = useState<PaymentIntent>({ type: "hold" })
  const [paymentSavedId, setPaymentSavedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [baggage, setBaggage] = useState<NonNullable<AncillarySelection["baggage"]>>([])
  const [assistance, setAssistance] = useState<NonNullable<AncillarySelection["assistance"]>>([])
  const [extras, setExtras] = useState<NonNullable<AncillarySelection["extras"]>>([])
  const [seats, setSeats] = useState<NonNullable<AncillarySelection["seats"]>>([])
  const [fareBundles, setFareBundles] = useState<NonNullable<AncillarySelection["fareBundle"]>>([])
  const [seatsMode, setSeatsMode] = useState<"skip" | "auto" | "now">("auto")
  const [sameForBothDirections, setSameForBothDirections] = useState(true)
  const [sameFareForAllPax, setSameFareForAllPax] = useState(true)

  // Compute the visible step list dynamically — adapter capability gating.
  // Loading-aware: show optionals while the catalog is still in flight so the
  // stepper doesn't grow when data lands; once loaded, hide what's empty.
  const steps = useMemo<ReadonlyArray<StepDef>>(() => {
    const hasFareBundles =
      (selection.outbound.fareBundles?.length ?? 0) > 0 ||
      (selection.return?.fareBundles?.length ?? 0) > 0
    const cat = ancillaries?.outboundCatalog
    const catReturn = ancillaries?.returnCatalog
    const ancillariesLoading = !!ancillaries?.loading
    const hasBags =
      ancillariesLoading || (cat?.baggage.length ?? 0) > 0 || (catReturn?.baggage.length ?? 0) > 0
    const hasServices =
      ancillariesLoading ||
      (cat?.assistance.length ?? 0) > 0 ||
      (cat?.extras.length ?? 0) > 0 ||
      (catReturn?.assistance.length ?? 0) > 0 ||
      (catReturn?.extras.length ?? 0) > 0
    const hasSeats = !!seatMaps

    return ALL_STEPS.filter((s) => {
      if (ALWAYS_VISIBLE.has(s.id)) return true
      if (s.id === "fares") return hasFareBundles
      if (s.id === "bags") return hasBags
      if (s.id === "seats") return hasSeats
      if (s.id === "services") return hasServices
      return true
    })
  }, [
    selection.outbound.fareBundles,
    selection.return?.fareBundles,
    ancillaries?.outboundCatalog,
    ancillaries?.returnCatalog,
    ancillaries?.loading,
    seatMaps,
  ])

  // If the visible-step list shrinks while we're sitting on a now-hidden
  // step (e.g., catalog loaded with no services), fall back to the prior
  // visible step. Done in render to keep state derived + free of effects.
  const stepIdx = (() => {
    const idx = steps.findIndex((s) => s.id === stepId)
    return idx >= 0 ? idx : 0
  })()
  const step = steps[stepIdx]
  const combinedOffer = useMemo(() => mergeOffers(selection), [selection])
  const ancillarySelection = useMemo<AncillarySelection | undefined>(() => {
    if (
      baggage.length === 0 &&
      assistance.length === 0 &&
      extras.length === 0 &&
      seats.length === 0 &&
      fareBundles.length === 0
    ) {
      return undefined
    }
    return {
      ...(baggage.length > 0 ? { baggage } : {}),
      ...(assistance.length > 0 ? { assistance } : {}),
      ...(extras.length > 0 ? { extras } : {}),
      ...(seats.length > 0 ? { seats } : {}),
      ...(fareBundles.length > 0 ? { fareBundle: fareBundles } : {}),
    }
  }, [baggage, assistance, extras, seats, fareBundles])

  const paxErrors = validatePassengers(paxList)
  const billingError = validateBilling(billing)

  // Per-leg ledger line items derived from picks + catalogs + seat picks.
  const { outboundExtras, returnExtras } = useMemo(
    () =>
      buildLedgerExtras({
        baggage,
        extras,
        assistance,
        seats,
        fareBundles,
        outboundOffer: selection.outbound,
        returnOffer: selection.return,
        outboundCatalog: ancillaries?.outboundCatalog ?? null,
        returnCatalog: ancillaries?.returnCatalog ?? null,
        seatMaps,
      }),
    [
      baggage,
      extras,
      assistance,
      seats,
      fareBundles,
      selection.outbound,
      selection.return,
      ancillaries?.outboundCatalog,
      ancillaries?.returnCatalog,
      seatMaps,
    ],
  )

  const completedSections = useMemo(() => {
    const set = new Set<
      "flights" | "passengers" | "bags" | "seats" | "services" | "billing" | "payment"
    >()
    set.add("flights")
    // A section is "complete" once the user has navigated past it. We only
    // mark sections that correspond to currently-visible steps.
    const passedIdx = stepIdx
    const visibleIds = new Set(steps.map((s) => s.id))
    const passed = (id: StepId) => {
      if (!visibleIds.has(id)) return false
      const i = steps.findIndex((s) => s.id === id)
      return i >= 0 && passedIdx > i
    }
    if (passed("passengers")) set.add("passengers")
    if (passed("bags")) set.add("bags")
    if (passed("seats")) set.add("seats")
    if (passed("services")) set.add("services")
    if (passed("billing")) set.add("billing")
    if (stepIdx >= steps.length - 1) set.add("payment")
    return set
  }, [stepIdx, steps])

  if (!step) return null

  const canContinue = (() => {
    switch (step.id) {
      case "review":
        return true
      case "fares":
        // Fare bundles are optional — keeping the base "Basic" fare is fine.
        return true
      case "passengers":
        return Object.keys(paxErrors).length === 0 && paxList.length > 0
      case "bags":
        // Bags are optional — user may skip every passenger.
        return true
      case "seats":
        // Seats are optional under "skip" / "auto"; under "now" any picks are fine.
        return true
      case "services":
        return true
      case "billing":
        return billingError == null
      case "payment":
        return true
      case "confirm":
        return true
    }
  })()

  const goNext = () => {
    if (step?.id === "billing" && billing.saveAsDefault) {
      onSaveBillingDefaults?.(billing)
    }
    const nextStep = steps[Math.min(steps.length - 1, stepIdx + 1)]
    if (nextStep) setStepId(nextStep.id)
  }
  const goBack = () => {
    const prevStep = steps[Math.max(0, stepIdx - 1)]
    if (prevStep) setStepId(prevStep.id)
  }

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      // Attach the structured billing address to the payment intent (when card)
      // and surface the contact (email/phone) at the request level. Travel
      // documents already live on each FlightPassenger.documents from the
      // merged passenger form — no extra plumbing needed here.
      const billingAddress = {
        line1: billing.line1,
        ...(billing.line2 ? { line2: billing.line2 } : {}),
        city: billing.city,
        ...(billing.region ? { region: billing.region } : {}),
        ...(billing.postalCode ? { postalCode: billing.postalCode } : {}),
        countryCode: billing.countryCode,
      }
      const paymentWithAddress: PaymentIntent =
        payment.type === "card" ? { ...payment, billingAddress } : payment

      const order = await onBook({
        offerId: combinedOffer.offerId,
        offer: combinedOffer,
        passengers: paxList,
        contact: { email: billing.email, phone: billing.phone },
        paymentIntent: paymentWithAddress,
        ...(ancillarySelection ? { ancillaries: ancillarySelection } : {}),
      })
      onBooked?.(order)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <Stepper steps={steps} currentIdx={stepIdx} />

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {step.id === "review" && (
            <ReviewStep selection={selection} carrierName={carrierName} airportName={airportName} />
          )}

          {step.id === "fares" && (
            <FlightFareUpsellStep
              outboundOffer={selection.outbound}
              returnOffer={selection.return}
              passengers={paxList}
              passengerCounts={passengers}
              value={fareBundles}
              onChange={setFareBundles}
              sameForAllPassengers={sameFareForAllPax}
              onSameForAllPassengersChange={setSameFareForAllPax}
            />
          )}

          {step.id === "passengers" && (
            <FlightPassengerForm
              counts={passengers}
              value={paxList}
              onChange={setPaxList}
              documentsRequired={documentsRequired}
              renderPicker={renderPassengerPicker}
            />
          )}

          {step.id === "bags" && (
            <FlightBaggageStep
              outboundCatalog={ancillaries?.outboundCatalog ?? null}
              returnCatalog={ancillaries?.returnCatalog ?? null}
              outboundOffer={selection.outbound}
              returnOffer={selection.return}
              passengers={paxList}
              passengerCounts={passengers}
              value={baggage}
              onChange={setBaggage}
              sameForBothDirections={sameForBothDirections}
              onSameForBothDirectionsChange={setSameForBothDirections}
              loading={ancillaries?.loading}
            />
          )}

          {step.id === "seats" && (
            <FlightSeatsStep
              outboundOffer={selection.outbound}
              returnOffer={selection.return}
              passengers={paxList}
              passengerCounts={passengers}
              value={seats}
              onChange={setSeats}
              mode={seatsMode}
              onModeChange={setSeatsMode}
              getSeatMap={
                seatMaps?.getSeatMap ?? (() => ({ seatMap: null, error: "Seat maps unavailable" }))
              }
            />
          )}

          {step.id === "services" && (
            <FlightServicesStep
              outboundCatalog={ancillaries?.outboundCatalog ?? null}
              returnCatalog={ancillaries?.returnCatalog ?? null}
              outboundOffer={selection.outbound}
              returnOffer={selection.return}
              passengers={paxList}
              passengerCounts={passengers}
              assistance={assistance}
              extras={extras}
              onAssistanceChange={setAssistance}
              onExtrasChange={setExtras}
              loading={ancillaries?.loading}
            />
          )}

          {step.id === "billing" && (
            <FlightBillingStep
              value={billing}
              onChange={setBilling}
              eligiblePassengers={paxList
                .filter(
                  (p) =>
                    p.type === "adult" && p.firstName.trim() !== "" && p.lastName.trim() !== "",
                )
                .map((p) => ({
                  id: p.passengerId,
                  firstName: p.firstName,
                  ...(p.middleName ? { middleName: p.middleName } : {}),
                  lastName: p.lastName,
                }))}
              renderPersonPicker={renderBillingPersonPicker}
              renderOrgPicker={renderBillingOrgPicker}
            />
          )}

          {step.id === "payment" && (
            <FlightPaymentStep
              value={payment}
              onChange={setPayment}
              savedMethods={savedPaymentMethods?.methods ?? []}
              loadingSavedMethods={savedPaymentMethods?.loading}
              selectedSavedId={paymentSavedId}
              onSelectSaved={setPaymentSavedId}
              capabilities={paymentCapabilities}
            />
          )}

          {step.id === "confirm" && (
            <ConfirmStep
              selection={selection}
              passengers={paxList}
              billing={billing}
              payment={payment}
              carrierName={carrierName}
              airportName={airportName}
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

      <div className="lg:sticky lg:top-6">
        <FlightBookingLedger
          selection={selection}
          passengers={passengers}
          carrierName={carrierName}
          airportName={airportName}
          outboundExtras={outboundExtras}
          returnExtras={returnExtras}
          onEditOutbound={onEditOutbound}
          onEditReturn={onEditReturn}
          completedSections={completedSections}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps
// ─────────────────────────────────────────────────────────────────────────────

function ReviewStep({
  selection,
  carrierName,
  airportName,
}: {
  selection: FlightItinerarySelection
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
}) {
  const isRoundTrip = !!selection.return
  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold text-base">
        {isRoundTrip ? "Review your trip" : "Review your flight"}
      </h2>
      <FlightItinerary
        itinerary={selection.outbound.itineraries[0] ?? { segments: [] }}
        label={isRoundTrip ? "Outbound" : undefined}
        carrierName={carrierName}
        airportName={airportName}
      />
      {selection.return && (
        <FlightItinerary
          itinerary={selection.return.itineraries[0] ?? { segments: [] }}
          label="Return"
          carrierName={carrierName}
          airportName={airportName}
        />
      )}
    </div>
  )
}

function ConfirmStep({
  selection,
  passengers,
  billing,
  payment,
  carrierName,
  airportName,
}: {
  selection: FlightItinerarySelection
  passengers: FlightPassenger[]
  billing: BillingValue
  payment: PaymentIntent
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
}) {
  const docsCount = passengers.filter((p) => (p.documents?.length ?? 0) > 0).length
  const isRoundTrip = !!selection.return
  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold text-base">Confirm booking</h2>
      <div className="flex flex-col gap-4">
        <FlightItinerary
          itinerary={selection.outbound.itineraries[0] ?? { segments: [] }}
          label={isRoundTrip ? "Outbound" : undefined}
          compact
          carrierName={carrierName}
          airportName={airportName}
        />
        {selection.return && (
          <FlightItinerary
            itinerary={selection.return.itineraries[0] ?? { segments: [] }}
            label="Return"
            compact
            carrierName={carrierName}
            airportName={airportName}
          />
        )}
      </div>
      <Row label="Passengers">{passengers.length}</Row>
      <Row label="Documents">
        {docsCount === passengers.length && passengers.length > 0
          ? `All ${docsCount} added`
          : docsCount > 0
            ? `${docsCount} of ${passengers.length} added`
            : "Add at check-in"}
      </Row>
      <Row label="Contact">{billing.email || "—"}</Row>
      <Row label="Billed to">
        {billing.mode === "company"
          ? `${billing.companyName ?? "—"} · ${billing.vatNumber ?? ""}`
          : `${billing.firstName} ${billing.lastName}`.trim() || "—"}
      </Row>
      <Row label="Payment">
        <span className="capitalize">{payment.type.replace("_", " ")}</span>
      </Row>
      <p className="text-muted-foreground text-xs">
        Submitting will hold seats with the connector and (depending on the chosen payment intent)
        either issue tickets immediately or open a ticketing window. The booking will appear under
        the order id once confirmed.
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

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({ steps, currentIdx }: { steps: ReadonlyArray<StepDef>; currentIdx: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {steps.map((s, i) => {
        const isActive = i === currentIdx
        const isComplete = i < currentIdx
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-medium text-xs tabular-nums",
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
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger line items from ancillary picks
// ─────────────────────────────────────────────────────────────────────────────

function buildLedgerExtras({
  baggage,
  extras,
  assistance,
  seats,
  fareBundles,
  outboundOffer,
  returnOffer,
  outboundCatalog,
  returnCatalog,
  seatMaps,
}: {
  baggage: NonNullable<AncillarySelection["baggage"]>
  extras: NonNullable<AncillarySelection["extras"]>
  assistance: NonNullable<AncillarySelection["assistance"]>
  seats: NonNullable<AncillarySelection["seats"]>
  fareBundles: NonNullable<AncillarySelection["fareBundle"]>
  outboundOffer: FlightOffer
  returnOffer?: FlightOffer
  outboundCatalog: AncillaryCatalog | null
  returnCatalog: AncillaryCatalog | null
  seatMaps?: FlightBookingSeatMaps
}): { outboundExtras: LedgerLineItem[]; returnExtras: LedgerLineItem[] } {
  const lines = (
    sliceIndex: number,
    catalog: AncillaryCatalog | null,
    offer: FlightOffer | undefined,
  ): LedgerLineItem[] => {
    const out: LedgerLineItem[] = []

    // Fare-bundle picks (first so they sit at the top of the leg block).
    // Per-pax per-leg picks are aggregated by bundleId here — when everyone
    // is on the same fare we render "Standard fare · €36 (2 pax)"; mixed
    // picks render as separate lines per bundle.
    if (offer?.fareBundles) {
      const legPicks = fareBundles.filter((p) => p.sliceIndex === sliceIndex)
      const agg = new Map<
        string,
        { count: number; label: string; price: number; currency: string }
      >()
      for (const p of legPicks) {
        const bundle = offer.fareBundles.find((b) => b.id === p.bundleId)
        if (!bundle) continue
        const prev = agg.get(bundle.id)
        if (prev) {
          prev.count += 1
          prev.price += Number(bundle.priceDelta.amount)
        } else {
          agg.set(bundle.id, {
            count: 1,
            label: bundle.label,
            price: Number(bundle.priceDelta.amount),
            currency: bundle.priceDelta.currency,
          })
        }
      }
      for (const [, v] of agg) {
        const labelSuffix = v.count > 1 ? ` (${v.count} pax)` : ""
        out.push({
          label: `${v.label} fare${labelSuffix}`,
          amount: v.price > 0 ? { amount: v.price.toFixed(2), currency: v.currency } : undefined,
          meta: v.price === 0 ? "Included" : undefined,
        })
      }
    }

    if (catalog) {
      // Baggage — group by option label, sum quantities + prices.
      const bagPicks = baggage.filter((b) => b.sliceIndex === sliceIndex)
      const bagAgg = new Map<
        string,
        { count: number; label: string; price: number; currency: string }
      >()
      for (const p of bagPicks) {
        const opt = catalog.baggage.find((o) => o.id === p.optionId)
        if (!opt) continue
        const k = opt.id
        const prev = bagAgg.get(k)
        const qty = p.quantity ?? 1
        if (prev) {
          prev.count += qty
          prev.price += Number(opt.price.amount) * qty
        } else {
          bagAgg.set(k, {
            count: qty,
            label: opt.label,
            price: Number(opt.price.amount) * qty,
            currency: opt.price.currency,
          })
        }
      }
      for (const [, v] of bagAgg) {
        out.push({
          label: v.count > 1 ? `${v.count}× ${v.label}` : v.label,
          amount: v.price > 0 ? { amount: v.price.toFixed(2), currency: v.currency } : undefined,
          meta: v.price === 0 ? "Included" : undefined,
        })
      }

      // Extras — same aggregation.
      const extraPicks = extras.filter((b) => b.sliceIndex === sliceIndex)
      const extAgg = new Map<
        string,
        { count: number; label: string; price: number; currency: string }
      >()
      for (const p of extraPicks) {
        const opt = catalog.extras.find((o) => o.id === p.optionId)
        if (!opt) continue
        const qty = p.quantity ?? 1
        const prev = extAgg.get(opt.id)
        if (prev) {
          prev.count += qty
          prev.price += Number(opt.price.amount) * qty
        } else {
          extAgg.set(opt.id, {
            count: qty,
            label: opt.label,
            price: Number(opt.price.amount) * qty,
            currency: opt.price.currency,
          })
        }
      }
      for (const [, v] of extAgg) {
        out.push({
          label: v.count > 1 ? `${v.count}× ${v.label}` : v.label,
          amount: { amount: v.price.toFixed(2), currency: v.currency },
        })
      }
    }

    // Seats — sum across all segments belonging to this leg's offer.
    if (offer && seatMaps) {
      const segIds = new Set<string>()
      for (const itin of offer.itineraries) {
        for (const seg of itin.segments) segIds.add(seg.segmentId)
      }
      const seatPicks = seats.filter((p) => segIds.has(p.segmentId))
      if (seatPicks.length > 0) {
        let total = 0
        let currency = "EUR"
        for (const pick of seatPicks) {
          const slot = seatMaps.getSeatMap({ offerId: offer.offerId, segmentId: pick.segmentId })
          const seat = slot.seatMap ? findSeatInMap(slot.seatMap, pick.seatNumber) : null
          if (seat?.price) {
            total += Number(seat.price.amount)
            currency = seat.price.currency
          }
        }
        out.push({
          label: `${seatPicks.length} seat${seatPicks.length > 1 ? "s" : ""} picked`,
          amount: total > 0 ? { amount: total.toFixed(2), currency } : undefined,
          meta: total === 0 ? "Free" : undefined,
        })
      }
    }

    // Assistance — only on the outbound block (it's trip-wide, not per leg).
    if (sliceIndex === 0 && assistance.length > 0) {
      out.push({
        label: `Special assistance (${assistance.length})`,
        meta: "Free",
      })
    }
    return out
  }
  return {
    outboundExtras: lines(0, outboundCatalog, outboundOffer),
    returnExtras: lines(1, returnCatalog ?? outboundCatalog, returnOffer),
  }
}

function findSeatInMap(map: SeatMap, seatNumber: string) {
  for (const row of map.rows) {
    for (const seat of row.seats) {
      if (seat.seatNumber === seatNumber) return seat
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer merging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synthesize a single combined `FlightOffer` from a per-leg selection. This
 * gives the booking adapter the same shape it would have received from a
 * single round-trip search (one offer, multiple itineraries) — so the
 * existing `bookFlight` contract works unchanged. The combined `offerId` is
 * `<outboundId>+<returnId>` so it round-trips through caching cleanly.
 */
function mergeOffers(selection: FlightItinerarySelection): FlightOffer {
  const { outbound, return: ret } = selection
  if (!ret) return outbound
  const currency = outbound.totalPrice.currency
  const amount = (Number(outbound.totalPrice.amount) + Number(ret.totalPrice.amount)).toFixed(2)
  return {
    offerId: `${outbound.offerId}+${ret.offerId}`,
    source: outbound.source,
    itineraries: [...outbound.itineraries, ...ret.itineraries],
    fareBreakdowns: [...outbound.fareBreakdowns, ...ret.fareBreakdowns],
    totalPrice: { amount, currency },
    validatingCarrier: outbound.validatingCarrier,
    expiresAt: pickEarliest(outbound.expiresAt, ret.expiresAt),
    lastTicketingDate: pickEarliest(outbound.lastTicketingDate, ret.lastTicketingDate),
    instantTicketing: (outbound.instantTicketing ?? false) && (ret.instantTicketing ?? false),
    providerData: {
      ...(outbound.providerData ?? {}),
      ...(ret.providerData ?? {}),
      __mergedFrom: { outbound: outbound.offerId, return: ret.offerId },
    },
  }
}

function pickEarliest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b
}
