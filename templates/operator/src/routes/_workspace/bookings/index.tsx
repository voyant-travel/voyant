import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { getBookingsQueryOptions } from "@voyantjs/bookings-react"
import type { BookingListFiltersState } from "@voyantjs/bookings-ui/components/booking-list"
import { Button } from "@voyantjs/ui/components/button"
import { Route as RouteIcon } from "lucide-react"
import { lazy, Suspense } from "react"
import { z } from "zod"

import { BookingsListSkeleton } from "@/components/voyant/bookings/bookings-list-skeleton"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const BookingsPage = lazy(() =>
  import("@voyantjs/bookings-ui/components/bookings-page").then((module) => ({
    default: module.BookingsPage,
  })),
)

const sortBySchema = z.enum([
  "bookingNumber",
  "status",
  "sellAmount",
  "pax",
  "startDate",
  "endDate",
  "createdAt",
])
const sortDirSchema = z.enum(["asc", "desc"])

const bookingsRouteSearchSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  productId: z.string().optional(),
  optionId: z.string().optional(),
  supplierId: z.string().optional(),
  productCategoryId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  availabilitySlotId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  paxMin: z.string().optional(),
  paxMax: z.string().optional(),
  sortBy: sortBySchema.optional(),
  sortDir: sortDirSchema.optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

type BookingsRouteSearch = z.infer<typeof bookingsRouteSearchSchema>

export const Route = createFileRoute("/_workspace/bookings/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getBookingsQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  validateSearch: bookingsRouteSearchSchema,
  pendingComponent: BookingsListSkeleton,
  component: BookingsRoute,
})

function BookingsRoute() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  return (
    <Suspense fallback={<BookingsListSkeleton />}>
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
        initialFilters={searchToFilters(search)}
        onFiltersChange={(filters) =>
          void navigate({
            to: "/bookings",
            search: filtersToSearch(filters),
            replace: true,
          })
        }
      />
    </Suspense>
  )
}

/** URL search params → `BookingList` initial state. Empty / `"all"` /
 * default values are absent in the URL; we let `BookingList`'s defaults
 * fill them in. */
function searchToFilters(search: BookingsRouteSearch): Partial<BookingListFiltersState> {
  return {
    search: search.search,
    status: search.status,
    productId: search.productId ?? null,
    optionId: search.optionId ?? null,
    supplierId: search.supplierId ?? null,
    productCategoryId: search.productCategoryId ?? null,
    personId: search.personId ?? null,
    organizationId: search.organizationId ?? null,
    availabilitySlotId: search.availabilitySlotId ?? null,
    dateFrom: search.dateFrom ?? null,
    dateTo: search.dateTo ?? null,
    paxMin: search.paxMin,
    paxMax: search.paxMax,
    sortBy: search.sortBy,
    sortDir: search.sortDir,
    offset: search.offset,
  }
}

/** Project the filter snapshot back into URL search params, dropping
 * any value that matches the component's default so the URL stays
 * clean when the operator is viewing the unfiltered list. */
function filtersToSearch(filters: BookingListFiltersState): BookingsRouteSearch {
  return {
    search: filters.search || undefined,
    status: filters.status === "all" ? undefined : filters.status,
    productId: filters.productId ?? undefined,
    optionId: filters.optionId ?? undefined,
    supplierId: filters.supplierId ?? undefined,
    productCategoryId: filters.productCategoryId ?? undefined,
    personId: filters.personId ?? undefined,
    organizationId: filters.organizationId ?? undefined,
    availabilitySlotId: filters.availabilitySlotId ?? undefined,
    dateFrom: filters.dateFrom ?? undefined,
    dateTo: filters.dateTo ?? undefined,
    paxMin: filters.paxMin || undefined,
    paxMax: filters.paxMax || undefined,
    sortBy: filters.sortBy === "createdAt" ? undefined : filters.sortBy,
    sortDir: filters.sortDir === "desc" ? undefined : filters.sortDir,
    offset: filters.offset === 0 ? undefined : filters.offset,
  }
}
