"use client"

import type { FlightPassenger, PaymentIntent } from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Check } from "lucide-react"
import type React from "react"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import type { BillingValue } from "./flight-billing-step.js"
import type { FlightItinerarySelection } from "./flight-booking-ledger.js"
import type { StepDef } from "./flight-booking-shell-types.js"
import { FlightItinerary } from "./flight-itinerary.js"

export function ReviewStep({
  selection,
  carrierName,
  airportName,
}: {
  selection: FlightItinerarySelection
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
}) {
  const messages = useFlightsUiMessagesOrDefault()
  const isRoundTrip = !!selection.return
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-card p-6 shadow-sm">
      <h2 className="font-semibold text-base">
        {isRoundTrip
          ? messages.flightBookingShell.reviewTrip
          : messages.flightBookingShell.reviewFlight}
      </h2>
      <FlightItinerary
        itinerary={selection.outbound.itineraries[0] ?? { segments: [] }}
        label={isRoundTrip ? messages.common.legLabels.outbound : undefined}
        carrierName={carrierName}
        airportName={airportName}
      />
      {selection.return && (
        <FlightItinerary
          itinerary={selection.return.itineraries[0] ?? { segments: [] }}
          label={messages.common.legLabels.return}
          carrierName={carrierName}
          airportName={airportName}
        />
      )}
    </div>
  )
}

export function ConfirmStep({
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
  const messages = useFlightsUiMessagesOrDefault()
  const docsCount = passengers.filter((p) => (p.documents?.length ?? 0) > 0).length
  const isRoundTrip = !!selection.return
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-card p-6 shadow-sm">
      <h2 className="font-semibold text-base">{messages.flightBookingShell.confirmTitle}</h2>
      <div className="flex flex-col gap-4">
        <FlightItinerary
          itinerary={selection.outbound.itineraries[0] ?? { segments: [] }}
          label={isRoundTrip ? messages.common.legLabels.outbound : undefined}
          compact
          carrierName={carrierName}
          airportName={airportName}
        />
        {selection.return && (
          <FlightItinerary
            itinerary={selection.return.itineraries[0] ?? { segments: [] }}
            label={messages.common.legLabels.return}
            compact
            carrierName={carrierName}
            airportName={airportName}
          />
        )}
      </div>
      <Row label={messages.flightBookingShell.rows.passengers}>{passengers.length}</Row>
      <Row label={messages.flightBookingShell.rows.documents}>
        {docsCount === passengers.length && passengers.length > 0
          ? formatMessage(messages.flightBookingShell.documentsAllAdded, { count: docsCount })
          : docsCount > 0
            ? formatMessage(messages.flightBookingShell.documentsSomeAdded, {
                count: docsCount,
                total: passengers.length,
              })
            : messages.flightBookingShell.documentsAddAtCheckIn}
      </Row>
      <Row label={messages.flightBookingShell.rows.contact}>
        {billing.email || messages.common.noValue}
      </Row>
      <Row label={messages.flightBookingShell.rows.billedTo}>
        {billing.mode === "company"
          ? `${billing.companyName ?? messages.common.noValue} · ${billing.vatNumber ?? ""}`
          : `${billing.firstName} ${billing.lastName}`.trim() || messages.common.noValue}
      </Row>
      <Row label={messages.flightBookingShell.rows.payment}>
        <span>{messages.flightPaymentSelector.intents[payment.type].title}</span>
      </Row>
      <p className="text-muted-foreground text-xs">
        {messages.flightBookingShell.confirmDescription}
      </p>
    </div>
  )
}

export function Stepper({
  steps,
  currentIdx,
  messages,
}: {
  steps: ReadonlyArray<StepDef>
  currentIdx: number
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
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
              {messages.flightBookingShell.steps[s.id]}
            </span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
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
