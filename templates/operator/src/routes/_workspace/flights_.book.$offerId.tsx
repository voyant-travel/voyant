import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useFlightBook } from "@voyantjs/flights-react"
import type { PaymentStepCapabilities } from "@voyantjs/flights-react/components/flight-payment-step"
import { lazy, Suspense } from "react"
import { z } from "zod"

const FlightBookingPage = lazy(() =>
  import("@voyantjs/flights-react/components/flight-booking-page").then((module) => ({
    default: module.FlightBookingPage,
  })),
)

/**
 * Booking journey route. Pax counts + cabin live in the URL so the page
 * survives a refresh. `$offerId` is the outbound offer id; the optional
 * `return` search param carries the return-leg offer id when round-trip.
 * Both offers are read from the TanStack Query cache populated by the
 * search page; if the cache is cold the page surfaces an "offer expired"
 * prompt with a back-to-search CTA.
 */
const flightBookSearchSchema = z.object({
  /** Return-leg offer id — present only when the trip is round-trip. */
  return: z.string().optional(),
  pax_a: z.coerce.number().int().min(1).default(1),
  pax_c: z.coerce.number().int().min(0).default(0),
  pax_i: z.coerce.number().int().min(0).default(0),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
})

export type FlightBookSearchParams = z.infer<typeof flightBookSearchSchema>

export const Route = createFileRoute("/_workspace/flights_/book/$offerId")({
  component: FlightBookingRoute,
  validateSearch: flightBookSearchSchema,
})

const paymentCapabilities: PaymentStepCapabilities = { chargeSavedCard: false, newCard: false }

function FlightBookingRoute() {
  const navigate = useNavigate()
  const { offerId } = Route.useParams()
  const search = Route.useSearch()
  const bookMutation = useFlightBook()

  return (
    <Suspense fallback={null}>
      <FlightBookingPage
        outboundOfferId={offerId}
        returnOfferId={search.return}
        passengers={{
          adults: search.pax_a ?? 1,
          children: search.pax_c ?? 0,
          infants: search.pax_i ?? 0,
        }}
        paymentCapabilities={paymentCapabilities}
        onBackToSearch={() => navigate({ to: "/flights" })}
        onAddPassengerContact={() => window.open("/people", "_blank")}
        onBook={async (request) => {
          const result = await bookMutation.mutateAsync(request)
          return result.order
        }}
        onBooked={(order) => {
          navigate({
            to: "/bookings/$id",
            params: { id: order.orderId },
          })
        }}
      />
    </Suspense>
  )
}
