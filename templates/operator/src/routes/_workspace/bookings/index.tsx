import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { defaultFetcher, getBookingsQueryOptions } from "@voyantjs/bookings-react"
import { BookingsPage } from "@voyantjs/bookings-ui"

import { BookingsListSkeleton } from "@/components/voyant/bookings/bookings-list-skeleton"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/bookings/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getBookingsQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }),
    ),
  pendingComponent: BookingsListSkeleton,
  component: BookingsRoute,
})

function BookingsRoute() {
  const navigate = useNavigate()

  return (
    <BookingsPage
      onBookingOpen={(booking) =>
        void navigate({ to: "/bookings/$id", params: { id: booking.id } })
      }
    />
  )
}
