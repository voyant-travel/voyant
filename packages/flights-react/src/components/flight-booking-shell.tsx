"use client"

import type {
  AncillarySelection,
  FlightPassenger,
  PaymentIntent,
} from "@voyant-travel/flights/contract/types"
import { Button } from "@voyant-travel/ui/components/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import { FlightBaggageStep } from "./flight-baggage-step.js"
import {
  type BillingValue,
  emptyBillingValue,
  FlightBillingStep,
  validateBilling,
} from "./flight-billing-step.js"
import { FlightBookingLedger } from "./flight-booking-ledger.js"
import {
  buildLedgerExtras,
  getVisibleFlightBookingSteps,
  mergeOffers,
} from "./flight-booking-shell-helpers.js"
import { ConfirmStep, ReviewStep, Stepper } from "./flight-booking-shell-panels.js"
import type { FlightBookingShellProps, StepId } from "./flight-booking-shell-types.js"

export type {
  FlightBookingAncillaries,
  FlightBookingSavedPaymentMethods,
  FlightBookingSeatMaps,
  FlightBookingShellProps,
} from "./flight-booking-shell-types.js"

import { FlightFareUpsellStep } from "./flight-fare-upsell-step.js"
import { FlightPassengerForm, validatePassengers } from "./flight-passenger-form.js"
import { FlightPaymentStep } from "./flight-payment-step.js"
import { FlightSeatsStep } from "./flight-seats-step.js"
import { FlightServicesStep } from "./flight-services-step.js"

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
  const messages = useFlightsUiMessagesOrDefault()
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

  const steps = useMemo(
    () => getVisibleFlightBookingSteps({ selection, ancillaries, seatMaps }),
    [selection, ancillaries, seatMaps],
  )

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
        messages,
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
      messages,
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
      <div className="flex min-w-0 flex-col gap-4">
        <Stepper steps={steps} currentIdx={stepIdx} messages={messages} />

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
                seatMaps?.getSeatMap ??
                (() => ({ seatMap: null, error: messages.flightBookingShell.seatMapsUnavailable }))
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
            {stepIdx === 0
              ? messages.flightBookingShell.backToResults
              : messages.flightBookingShell.back}
          </Button>
          {step.id === "confirm" ? (
            <Button onClick={submit} disabled={submitting}>
              {submitting
                ? messages.flightBookingShell.booking
                : messages.flightBookingShell.confirmBooking}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canContinue}>
              {messages.flightBookingShell.continue}
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
