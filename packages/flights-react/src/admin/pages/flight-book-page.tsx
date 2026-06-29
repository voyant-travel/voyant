"use client"

import { type AdminRoutePageProps, useAdminHref, useAdminNavigate } from "@voyant-travel/admin"

import { FlightBookingPage } from "../../components/flight-booking-page.js"
import type { PaymentStepCapabilities } from "../../components/flight-payment-step.js"
import { useFlightBook } from "../../hooks/use-flight-book.js"
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
 * through the package's own mutation hook, and resolves every cross-route
 * link through semantic destinations — back to `flight.search`, the
 * passenger-contact jump to `person.list` (new tab), and the post-booking
 * landing on `booking.detail` (a flight order confirms into a booking).
 */
// fallow-ignore-next-line unused-export
export default function FlightBookRoutePage({ params, search }: AdminRoutePageProps) {
  const navigateTo = useAdminNavigate()
  const resolveHref = useAdminHref()
  const bookMutation = useFlightBook()
  const bookSearch = search as FlightsBookSearchParams

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
      onBooked={(order) => navigateTo("booking.detail", { bookingId: order.orderId })}
    />
  )
}
