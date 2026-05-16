import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  defaultFetcher,
  getBookingActivityQueryOptions,
  getBookingNotesQueryOptions,
  getBookingQueryOptions,
  getSupplierStatusesQueryOptions,
  getTravelersQueryOptions,
} from "@voyantjs/bookings-react"
import { BookingCreatePage } from "@voyantjs/bookings-ui"
import { z } from "zod"
import { BookingDetailPage } from "@/components/voyant/bookings/booking-detail-page"
import { BookingDetailSkeleton } from "@/components/voyant/bookings/booking-detail-skeleton"
import { getApiUrl } from "@/lib/env"

const bookingRouteSearchSchema = z.object({
  productId: z.string().optional(),
})

export const Route = createFileRoute("/_workspace/bookings/$id")({
  loader: async ({ context, params }) => {
    if (params.id === "new") return

    const client = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

    await Promise.all([
      context.queryClient.ensureQueryData(getBookingQueryOptions(client, params.id)),
      context.queryClient.ensureQueryData(getTravelersQueryOptions(client, params.id)),
      context.queryClient.ensureQueryData(getSupplierStatusesQueryOptions(client, params.id)),
      context.queryClient.ensureQueryData(getBookingActivityQueryOptions(client, params.id)),
      context.queryClient.ensureQueryData(getBookingNotesQueryOptions(client, params.id)),
    ])
  },
  validateSearch: bookingRouteSearchSchema,
  pendingComponent: BookingDetailSkeleton,
  component: BookingDetailRoute,
})
function BookingDetailRoute() {
  const { id } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()

  if (id === "new") {
    return (
      <BookingCreatePage
        defaultProductId={search.productId}
        onCancel={() => void navigate({ to: "/bookings" })}
        onCreated={(booking) => void navigate({ to: "/bookings/$id", params: { id: booking.id } })}
      />
    )
  }

  return <BookingDetailPage id={id} />
}
