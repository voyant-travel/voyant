import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"
// Type-only on purpose: binds the bookings-ui `AdminDestinations`
// augmentation (`booking.detail`, ...) into this program — the booking
// wizard's post-booking navigation resolves through that shared key — without
// pulling any bookings runtime code into the chunk that evaluates this
// factory.
import type {} from "@voyantjs/bookings-react/admin"
import type { CabinClass } from "@voyantjs/flights/contract/types"
import { z } from "zod"

/**
 * Semantic destinations the flights admin surfaces navigate to
 * (packaged-admin RFC §4.7). `booking.detail` (where the wizard lands after
 * booking) comes from the bookings-ui augmentation bound above; declared here
 * are the flights-owned keys plus `person.list`, re-declared shape-locked —
 * also declared by `@voyantjs/crm-react/admin`, and interface merging requires
 * the member shape to stay identical across packages.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The flight search page (the flights area's landing surface). */
    "flight.search": Record<string, never>
    /**
     * The flight booking wizard for a picked offer (round-trip carries the
     * return-leg offer id). NOT route-backed: the resolver constructs the
     * `return`/`pax_*`/`cabin` search params, which is beyond pure path
     * interpolation — it stays hand-written in the host map.
     */
    "flightBooking.start": {
      offerId: string
      returnOfferId?: string
      adults: number
      children: number
      infants: number
      cabin: CabinClass
    }
    /** The CRM people list page (the wizard's "add passenger contact" jump). */
    "person.list": Record<string, never>
  }
}

/**
 * Search contract for the flight search page. Everything the page renders is
 * derived from this — the form values, the active filters, the page cursor,
 * the current leg being picked, and (when round-trip) the already-picked
 * outbound — so URLs are shareable, the back button works, and reload
 * preserves state.
 *
 * The per-leg pick model: round-trip searches show outbound results first;
 * once the user picks an outbound (`outboundOfferId` set, `leg` flips to
 * "return"), the page shows return results with the picked outbound pinned
 * at the top.
 */
export const flightsIndexSearchSchema = z
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

export type FlightsIndexSearchParams = z.infer<typeof flightsIndexSearchSchema>

/**
 * Search contract for the booking wizard route. Pax counts + cabin live in
 * the URL so the page survives a refresh. The route's `$offerId` param is the
 * outbound offer id; the optional `return` search param carries the
 * return-leg offer id when round-trip. Both offers are read from the
 * TanStack Query cache populated by the search page; if the cache is cold
 * the page surfaces an "offer expired" prompt with a back-to-search CTA.
 */
export const flightsBookSearchSchema = z.object({
  /** Return-leg offer id — present only when the trip is round-trip. */
  return: z.string().optional(),
  pax_a: z.coerce.number().int().min(1).default(1),
  pax_c: z.coerce.number().int().min(0).default(0),
  pax_i: z.coerce.number().int().min(0).default(0),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
})

export type FlightsBookSearchParams = z.infer<typeof flightsBookSearchSchema>

export interface CreateFlightsAdminExtensionOptions {
  /** Mount path of the flights pages inside the admin workspace. Default `/flights`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    flights?: string
  }
}

/**
 * The flights admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Flights nav item is part of the BASE
 * operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing a nav entry here would duplicate it.
 * If the base nav ever drops the flights item, this extension is where the
 * entry moves.
 *
 * ROUTES: full implementations (packaged-admin RFC §4.8 endgame) — the
 * package-owned search contracts ({@link flightsIndexSearchSchema} for the
 * search page, {@link flightsBookSearchSchema} for the wizard) and lazy
 * `page` modules; no loaders, because both pages fetch client-side (search
 * results are interactive POSTs, and the wizard reads its offers from the
 * query cache the search page populated). The wizard route is a SIBLING of
 * the search route, not a child: in the operator's old file-based tree it
 * was `flights_.book.$offerId` (the `_` escape opting out of the `/flights`
 * section chrome), and the code-assembled tree reproduces that exactly
 * because every contribution mounts flat under the workspace layout.
 *
 * `component:` stays unattached; each contribution carries a lazy `page`
 * loader instead, so the pages land in their own chunks and the wrappers
 * read route state off `AdminRoutePageProps`. Cross-route links resolve
 * through the semantic destinations declared above.
 *
 * WIDGETS: none today. No cross-domain flights card is slot-mounted.
 */
export function createFlightsAdminExtension(
  options: CreateFlightsAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/flights", labels = {} } = options
  const { flights = "Flights" } = labels

  return defineAdminExtension({
    id: "flights",
    routes: [
      {
        id: "flights-index",
        path: basePath,
        title: flights,
        // Route-backed destination (RFC §4.7 endgame): the key resolves by
        // pure path interpolation of this route, so the host's resolver is
        // generated (`voyant admin generate --destinations`).
        // `flightBooking.start` is deliberately NOT bound: its resolver
        // constructs search params, which is beyond path interpolation — it
        // stays hand-written.
        destination: "flight.search",
        validateSearch: (search) => flightsIndexSearchSchema.parse(search),
        page: () => import("./pages/flights-index-page.js"),
      },
      {
        id: "flights-book",
        path: `${basePath}/book/$offerId`,
        title: flights,
        validateSearch: (search) => flightsBookSearchSchema.parse(search),
        page: () => import("./pages/flight-book-page.js"),
      },
    ],
  })
}
