import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { getBookingsQueryOptions } from "@voyantjs/bookings-react"
import { BookingsPage } from "@voyantjs/bookings-ui"
import { Button } from "@voyantjs/ui/components/button"
import { Route as RouteIcon } from "lucide-react"

import { BookingsListSkeleton } from "@/components/voyant/bookings/bookings-list-skeleton"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/bookings/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getBookingsQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  pendingComponent: BookingsListSkeleton,
  component: BookingsRoute,
})

function BookingsRoute() {
  const navigate = useNavigate()

  return (
    <BookingsPage
      onCreateBooking={() => void navigate({ to: "/bookings/$id", params: { id: "new" } })}
      onBookingOpen={(booking) =>
        void navigate({ to: "/bookings/$id", params: { id: booking.id } })
      }
      headerActions={
        <Button
          variant="outline"
          onClick={() => void navigate({ to: "/trips/$id", params: { id: "new" } })}
        >
          <RouteIcon className="size-4" aria-hidden="true" />
          Compose trip
        </Button>
      }
    />
  )
}
