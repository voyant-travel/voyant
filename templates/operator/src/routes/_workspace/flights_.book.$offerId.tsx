import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { FlightBookingPage } from "@/components/voyant/flights/flight-booking-page"

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
  component: FlightBookingPage,
  validateSearch: flightBookSearchSchema,
})
