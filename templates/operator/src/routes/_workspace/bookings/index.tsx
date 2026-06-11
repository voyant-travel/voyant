import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { getBookingsQueryOptions } from "@voyantjs/bookings-react"
import {
  BookingsHost,
  BookingsListSkeleton,
  bookingsFiltersToSearch,
  bookingsIndexSearchSchema,
  bookingsSearchToFilters,
} from "@voyantjs/bookings-ui/admin"
import { Button } from "@voyantjs/ui/components/button"
import { Route as RouteIcon } from "lucide-react"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Thin host for the package-delivered bookings list (packaged-admin RFC
// Phase 3). Page, search contract, and navigation (semantic destinations,
// RFC §4.7) are package-owned; this file binds the URL search state onto
// the host's filter props and supplies the app-owned "Compose trip" action.
export const Route = createFileRoute("/_workspace/bookings/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getBookingsQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  validateSearch: bookingsIndexSearchSchema,
  pendingComponent: BookingsListSkeleton,
  component: BookingsRoute,
})

function BookingsRoute() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  return (
    <BookingsHost
      headerActions={
        <Button
          variant="outline"
          onClick={() => void navigate({ to: "/trips/$id", params: { id: "new" } })}
        >
          <RouteIcon className="size-4" aria-hidden="true" />
          Compose trip
        </Button>
      }
      initialFilters={bookingsSearchToFilters(search)}
      onFiltersChange={(filters) =>
        void navigate({
          to: "/bookings",
          search: bookingsFiltersToSearch(filters),
          replace: true,
        })
      }
    />
  )
}
