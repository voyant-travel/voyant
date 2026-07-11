import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  type AdminWidgetContribution,
  adminRoutePageModule,
  defineAdminExtension,
  type NavItem,
  type SelectedAdminExtensionFactoryContext,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyant-travel/admin"
// Type-only: binds the bookings-react `AdminDestinations` augmentation
// (`booking.detail`, `person.detail`, ...) into this program — the trip
// detail page's component rows and traveler/billing cells navigate through
// those shared keys, and `booking.detail`'s shape carries bookings-react's
// own tab union, so re-declaring it here could not stay shape-identical.
import { bookingsListHeaderActionsSlot } from "@voyant-travel/bookings-react/admin"
import { Button } from "@voyant-travel/ui/components/button"
import { Route } from "lucide-react"

// Lean static only: the client module (fetcher). Query options resolve via
// dynamic import inside the loaders so the trips data layer
// (client + response schemas) stays out of the workspace-chrome chunk that
// evaluates this factory.
import { defaultFetcher } from "../client.js"

/**
 * Semantic destinations the trips admin surfaces navigate to
 * (packaged-admin RFC §4.7). The trips list opens the trip detail page, the
 * detail page links back to the list and across to the booking/person
 * pages — instead of importing a host route tree they resolve these keys
 * through `useAdminHref`/`useAdminNavigate` from `@voyant-travel/admin`. Hosts
 * register one resolver per key (`satisfies AdminDestinationResolvers`).
 * Keys shared with other domains (`booking.detail`, `person.detail`) come
 * from the bookings-react augmentation bound above.
 */
declare module "@voyant-travel/admin" {
  interface AdminDestinations {
    /** The trips list page. */
    "trip.list": Record<string, never>
    /** A trip's detail page; the `"new"` pseudo-id opens the composer. */
    "trip.detail": { tripId: string }
  }
}

function ComposeTripButton() {
  const navigateTo = useAdminNavigate()
  const label = useOperatorAdminMessages().trips.list.composeTrip

  return (
    <Button variant="outline" onClick={() => navigateTo("trip.create", {})}>
      <Route className="size-4" aria-hidden="true" />
      {label}
    </Button>
  )
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the trips pages bound
// to their data wiring + semantic-destination navigation.
//
// Endgame rule (packaged-admin RFC §4.8): this barrel re-exports NO page
// or host component values — it is evaluated with the workspace chrome, so
// a static host re-export would pin the heavy page modules (the trip
// composer pulls the flights/catalog/bookings journeys) into the entry
// chunk. Hosts import from their specific modules; only their TYPES
// re-export here.
export type { AdminTripsPageProps } from "./admin-trips-page.js"
export type { TripListFiltersPopoverProps, TripStatusFilter } from "./trip-list-filters.js"

export interface CreateTripsAdminExtensionOptions {
  /** Mount path of the trips pages inside the admin workspace. Default `/trips`. */
  basePath?: string
  /** Localized nav/page labels. Defaults are the English operator nav labels. */
  labels?: {
    trips?: string
    allTrips?: string
    newTrip?: string
  }
  /** Nav icon — icon choice stays with the host (e.g. lucide `Route`). */
  icon?: NavItem["icon"]
}

/**
 * The trips admin contribution (packaged-admin RFC Phase 3,
 * `@voyant-travel/<domain>-react/admin` convention).
 *
 * NAVIGATION: package-delivered. Trips is NOT part of the BASE operator
 * navigation (`createOperatorAdminNavigation` in `@voyant-travel/admin`), so the
 * extension contributes the Trips group itself — spliced in right after
 * Bookings (both belong to the booking lifecycle) via `insertAfter`, with
 * All trips / New trip sub-items. The icon stays a host choice.
 *
 * ROUTES: contributions carry the FULL route implementation (packaged-admin
 * RFC §4.2/§4.8) — lazy `page` module loaders, data loaders fed by the
 * host-supplied {@link AdminRouteLoaderContext} (QueryClient + runtime +
 * params), per-route SSR mode. Hosts bind them into their code-assembled
 * admin route tree; no per-route host files needed. The pages stay
 * code-split because each contribution's `page` dynamically imports the
 * specific host/page module — never this barrel — and the trips
 * itself mounts through a nested `React.lazy`, so its heavy panel stack
 * (flights search, catalog browse, booking journey) only fetches when an
 * operator actually composes/edits a trip. The list keeps its filter/sort/
 * paging state local (no URL search contracts), and every cross-route link
 * resolves through the semantic destinations declared above — no app RPC
 * client, no host route tree.
 *
 * WIDGETS: contributes the Compose trip action to the Bookings list slot.
 */
export function createTripsAdminExtension(
  options: CreateTripsAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/trips", labels = {}, icon } = options
  const { trips = "Trips", allTrips = "All trips", newTrip = "New trip" } = labels

  return defineAdminExtension({
    id: "trips",
    navigation: [
      {
        // Splice Trips in right after Bookings — both belong to the booking
        // lifecycle. `insertAfter` keeps the contribution shape; the resolver
        // splices in place rather than appending at the end.
        insertAfter: "bookings",
        items: [
          {
            id: "trips",
            title: trips,
            url: basePath,
            icon,
            items: [
              {
                id: "trips-list",
                title: allTrips,
                url: basePath,
              },
              {
                id: "trips-new",
                title: newTrip,
                url: `${basePath}/new`,
              },
            ],
          },
        ],
      },
    ],
    routes: [
      {
        id: "trips-index",
        path: basePath,
        title: trips,
        // Route-backed destination (RFC §4.7 endgame): the key resolves by
        // pure path interpolation of this route, so the host's resolver is
        // generated (`voyant admin generate --destinations`).
        destination: "trip.list",
        ssr: "data-only",
        page: () =>
          import("./trips-host.js").then((module) => adminRoutePageModule(module.TripsHost)),
        // Dynamic import on purpose: the query options pull the
        // trips data layer (client + response schemas), and a
        // static import here would pin it into the workspace-chrome chunk
        // that evaluates this factory. The host module carries the matching
        // initial params so the seeded cache entry lines up with the page's
        // first query.
        loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
          const [{ listTripsQueryOptions }, { initialTripsListParams }] = await Promise.all([
            import("../query-options.js"),
            import("./trips-host.js"),
          ])
          return queryClient.ensureQueryData(
            listTripsQueryOptions(loaderClient(runtime), initialTripsListParams),
          )
        },
      },
      {
        id: "trips-detail",
        path: `${basePath}/$id`,
        title: trips,
        destination: "trip.detail",
        destinationParams: { id: "tripId" },
        ssr: "data-only",
        page: () => import("./pages/trip-detail-page.js"),
        // The `"new"` pseudo-id mounts the composer with no trip to fetch.
        // Dynamic import on purpose — see the trips index loader above.
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id || id === "new") return
          const { getTripQueryOptions } = await import("../query-options.js")
          return queryClient.ensureQueryData(getTripQueryOptions(loaderClient(runtime), id))
        },
      },
    ],
    widgets: [
      {
        id: "trips-compose-booking-action",
        slot: bookingsListHeaderActionsSlot,
        component: ComposeTripButton,
      } satisfies AdminWidgetContribution,
    ],
  })
}

/**
 * Bridge the host-supplied {@link AdminRouteRuntime} (optional fetcher) to
 * the required-fetcher client contract the trips query options
 * take — SSR loaders run with the host runtime's cookie-forwarding fetcher.
 */
function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}

export function createSelectedTripsAdminExtension({
  navMessages,
}: SelectedAdminExtensionFactoryContext): AdminExtension {
  return createTripsAdminExtension({
    labels: {
      trips: navMessages.trips,
      allTrips: navMessages.allTrips,
      newTrip: navMessages.newTrip,
    },
    icon: Route,
  })
}
