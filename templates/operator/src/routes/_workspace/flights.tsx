import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FlightsPage } from "@voyantjs/flights-ui"
import { z } from "zod"

/**
 * Search params for `/flights`. Everything the page renders is derived
 * from this — the form values, the active filters, the page cursor, the
 * current leg being picked, and (when round-trip) the already-picked
 * outbound — so URLs are shareable, the back button works, and reload
 * preserves state.
 *
 * The per-leg pick model: round-trip searches show outbound results first;
 * once the user picks an outbound (`outboundOfferId` set, `leg` flips to
 * "return"), the page shows return results with the picked outbound pinned
 * at the top.
 */
const flightsSearchSchema = z
  .object({
    tripType: z.enum(["round_trip", "one_way"]).default("round_trip"),
    from: z.string().optional(),
    to: z.string().optional(),
    depart: z.string().optional(),
    ret: z.string().optional(),
    leg: z.enum(["outbound", "return"]).default("outbound"),
    /** Set once the outbound is picked; drives the return-leg search. */
    outboundOfferId: z.string().optional(),
    /**
     * Set once the return is picked. Both ids set = "ready to book" state —
     * the page shows a trip summary with a Continue CTA instead of the
     * search results.
     */
    returnOfferId: z.string().optional(),
    pax_a: z.coerce.number().int().min(1).default(1),
    pax_c: z.coerce.number().int().min(0).default(0),
    pax_i: z.coerce.number().int().min(0).default(0),
    cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
    carriers: z.array(z.string()).optional(),
    maxStops: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .partial({
    tripType: true,
    pax_a: true,
    pax_c: true,
    pax_i: true,
    cabin: true,
    page: true,
    leg: true,
  })

export type FlightsSearchParams = z.infer<typeof flightsSearchSchema>

export const Route = createFileRoute("/_workspace/flights")({
  component: FlightsRoute,
  validateSearch: flightsSearchSchema,
})

function FlightsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const routerNavigate = useNavigate()

  return (
    <FlightsPage
      search={search}
      onSearchChange={(next, options) => {
        navigate({
          search: (): FlightsSearchParams => next as FlightsSearchParams,
          replace: options?.replace ?? false,
        })
      }}
      onBookOffer={({ outboundOfferId, returnOfferId, passengers, cabin }) => {
        routerNavigate({
          to: "/flights/book/$offerId",
          params: { offerId: outboundOfferId },
          search: {
            ...(returnOfferId ? { return: returnOfferId } : {}),
            pax_a: passengers.adults,
            pax_c: passengers.children ?? 0,
            pax_i: passengers.infants ?? 0,
            cabin,
          },
        })
      }}
    />
  )
}
