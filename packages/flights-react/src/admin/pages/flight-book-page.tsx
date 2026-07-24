"use client"

import { type AdminRoutePageProps, useAdminHref, useAdminNavigate } from "@voyant-travel/admin"
import type { FlightOrder } from "@voyant-travel/flights/contract/types"
import { Button } from "@voyant-travel/ui/components/button"
import { ChevronLeft } from "lucide-react"
import { useState } from "react"

import { FlightBookingPage } from "../../components/flight-booking-page.js"
import { FlightOrderConfirmation } from "../../components/flight-order-confirmation.js"
import type { PaymentStepCapabilities } from "../../components/flight-payment-step.js"
import { useAirlines, useAirports } from "../../hooks/index.js"
import { useFlightBook } from "../../hooks/use-flight-book.js"
import { useFlightsUiMessagesOrDefault } from "../../i18n/index.js"
import type { FlightsBookSearchParams } from "../index.js"

/** Card charging is not wired for the demo connector — collect details only. */
const paymentCapabilities: PaymentStepCapabilities = { chargeSavedCard: false, newCard: false }

/**
 * Open a resolved destination href in a new tab (keeps the wizard in place).
 * No-op during SSR and for unresolvable destinations (`"#"` is the
 * `useAdminHref` fallback — opening it would just clone the current page).
 */
function openHrefInNewTab(href: string): void {
  if (typeof window === "undefined" || href === "#") return
  window.open(href, "_blank", "noopener,noreferrer")
}

/**
 * Packaged route page for the flight booking wizard: binds the matched
 * route's `$offerId` param (the outbound offer) and the validated
 * pax/cabin/`return` search params onto {@link FlightBookingPage}, books
 * through the package's own mutation hook, and resolves the cross-route links
 * through semantic destinations — back to `flight.search` and the
 * passenger-contact jump to `person.list` (new tab).
 *
 * POST-BOOKING (issue #2653): a flight hold persists a FLIGHT ORDER, served
 * at `/v1/admin/flights/orders/:id`. That is a separate entity from a catalog
 * booking and is NOT resolvable at `/bookings/:id`, so navigating to the
 * catalog `booking.detail` destination 404s for a flight order id. The flights
 * admin does not yet ship a standalone `/flights/orders/:id` route, so instead
 * the wizard swaps in an inline {@link FlightOrderConfirmation} rendered from
 * the booking response — a readable order surface with no extra fetch. When a
 * dedicated flight-order route lands, this can navigate to it instead.
 */
// fallow-ignore-next-line unused-export
export default function FlightBookRoutePage({ params, search }: AdminRoutePageProps) {
  const navigateTo = useAdminNavigate()
  const resolveHref = useAdminHref()
  const bookMutation = useFlightBook()
  const messages = useFlightsUiMessagesOrDefault()
  const bookSearch = search as FlightsBookSearchParams
  const [bookedOrder, setBookedOrder] = useState<FlightOrder | null>(null)

  const airlinesQuery = useAirlines()
  const airportsQuery = useAirports({ limit: 200 })
  const carrierName = (code: string) =>
    airlinesQuery.data?.data.find((airline) => airline.iataCode === code)?.name
  const airportName = (code: string) => {
    const airport = airportsQuery.data?.data.find((item) => item.iataCode === code)
    return airport ? `${airport.city} (${airport.iataCode})` : undefined
  }

  if (bookedOrder) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-semibold text-2xl">{messages.flightBookingPage.title}</h1>
          <Button variant="ghost" onClick={() => navigateTo("flight.search", {})}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {messages.flightBookingPage.backToFlightSearch}
          </Button>
        </header>
        <FlightOrderConfirmation
          order={bookedOrder}
          carrierName={carrierName}
          airportName={airportName}
        />
      </div>
    )
  }

  return (
    <FlightBookingPage
      outboundOfferId={params.offerId ?? ""}
      returnOfferId={bookSearch.return}
      passengers={{
        adults: bookSearch.pax_a ?? 1,
        children: bookSearch.pax_c ?? 0,
        infants: bookSearch.pax_i ?? 0,
      }}
      paymentCapabilities={paymentCapabilities}
      onBackToSearch={() => navigateTo("flight.search", {})}
      onAddPassengerContact={() => openHrefInNewTab(resolveHref("person.list", {}))}
      onBook={async (request) => {
        const result = await bookMutation.mutateAsync(request)
        return result.order
      }}
      onBooked={(order) => setBookedOrder(order)}
    />
  )
}
