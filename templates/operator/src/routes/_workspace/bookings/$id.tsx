import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
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
import { CatalogProductPicker } from "@/components/voyant/catalog/catalog-product-picker"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const bookingTabSchema = z.enum([
  "items",
  "travelers",
  "finance",
  "invoices",
  "documents",
  "suppliers",
  "activity",
  "metadata",
])

const bookingRouteSearchSchema = z.object({
  productId: z.string().optional(),
  slotId: z.string().optional(),
  tab: bookingTabSchema.optional(),
})

export const Route = createFileRoute("/_workspace/bookings/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    if (params.id === "new") return

    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    // Critical: booking itself drives the header. Everything else
    // (travelers, supplier statuses, activity, notes) is per-section
    // and renders progressively.
    await context.queryClient.ensureQueryData(getBookingQueryOptions(client, params.id))

    void context.queryClient.prefetchQuery(getTravelersQueryOptions(client, params.id))
    void context.queryClient.prefetchQuery(getSupplierStatusesQueryOptions(client, params.id))
    void context.queryClient.prefetchQuery(getBookingActivityQueryOptions(client, params.id))
    void context.queryClient.prefetchQuery(getBookingNotesQueryOptions(client, params.id))
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
        defaultSlotId={search.slotId}
        onCancel={() => void navigate({ to: "/bookings" })}
        onCreated={(booking) => void navigate({ to: "/bookings/$id", params: { id: booking.id } })}
        // Unified picker: search spans owned + supplier-sourced. Owned picks
        // stay in the create-sheet; a supplier pick hands off to the booking
        // journey (the engine that does live quote/lock for sourced offers).
        renderProductPicker={(pickerProps) => (
          <CatalogProductPicker
            {...pickerProps}
            onSourcedSelected={(sel) =>
              void navigate({
                to: "/catalog/journey/$entityModule/$entityId",
                params: { entityModule: sel.entityModule, entityId: sel.entityId },
                search: {
                  sourceKind: sel.sourceKind,
                  ...(sel.sourceConnectionId ? { sourceConnectionId: sel.sourceConnectionId } : {}),
                  ...(sel.sourceRef ? { sourceRef: sel.sourceRef } : {}),
                },
              })
            }
          />
        )}
      />
    )
  }

  return (
    <BookingDetailPage
      id={id}
      activeTab={search.tab}
      onTabChange={(tab) =>
        void navigate({
          to: "/bookings/$id",
          params: { id },
          search: (prev) => ({ ...prev, tab }),
          replace: true,
        })
      }
    />
  )
}
