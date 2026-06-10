import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import {
  getBookingActivityQueryOptions,
  getBookingNotesQueryOptions,
  getBookingQueryOptions,
  getSupplierStatusesQueryOptions,
  getTravelersQueryOptions,
} from "@voyantjs/bookings-react"
import { useBookingsUiMessagesOrDefault } from "@voyantjs/bookings-ui/i18n"
import { lazy, Suspense } from "react"
import { z } from "zod"
import { BookingDetailSkeleton } from "@/components/voyant/bookings/booking-detail-skeleton"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const BookingDetailPage = lazy(() =>
  import("@/components/voyant/bookings/booking-detail-page").then((module) => ({
    default: module.BookingDetailPage,
  })),
)
const CatalogProductPicker = lazy(() =>
  import("@/components/voyant/catalog/catalog-product-picker").then((module) => ({
    default: module.CatalogProductPicker,
  })),
)

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
  // Deep-link into "New booking" with a product already chosen (e.g. launched
  // from a product page) → straight into the unified booking journey for that
  // owned product. No product picker needed.
  beforeLoad: ({ params, search }) => {
    if (params.id === "new" && search.productId) {
      throw redirect({
        to: "/catalog/journey/$entityModule/$entityId",
        params: { entityModule: "products", entityId: search.productId },
        search: {
          sourceKind: "owned",
          ...(search.slotId ? { departureId: search.slotId } : {}),
        },
      })
    }
  },
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
    return <NewBookingPicker />
  }

  return (
    <Suspense fallback={<BookingDetailSkeleton />}>
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
    </Suspense>
  )
}

/**
 * "New booking" entry. Pick an owned product, then route into the unified
 * booking journey (the same journey catalog detail/browse pages use) so every
 * booking goes through one flow — no separate owned-only create form.
 */
function NewBookingPicker() {
  const navigate = useNavigate()
  const messages = useBookingsUiMessagesOrDefault()

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-normal">
          {messages.bookingCreatePage.title}
        </h1>
        <p className="text-muted-foreground text-sm">{messages.bookingCreatePage.description}</p>
      </header>
      <Suspense fallback={null}>
        <CatalogProductPicker
          value={{ productId: "", optionId: null }}
          enabled
          lockProduct={false}
          // Owned pick -> journey with `owned` provenance. Clearing the field
          // yields an empty productId, which we ignore.
          onChange={(value) => {
            if (value.productId) {
              void navigate({
                to: "/catalog/journey/$entityModule/$entityId",
                params: { entityModule: "products", entityId: value.productId },
                search: { sourceKind: "owned" },
              })
            }
          }}
        />
      </Suspense>
    </main>
  )
}
