import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { SlotAllocationPage } from "@voyantjs/allocation-ui"
import {
  AvailabilitySlotDetailPage,
  AvailabilitySlotDetailSkeleton,
  getAvailabilitySlotDetailQueryOptions,
  getAvailabilitySlotProductQueryOptions,
  loadAvailabilitySlotDetailPage,
} from "@voyantjs/availability-ui"
import { BookingCreateDialog } from "@voyantjs/bookings-ui"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components"
import { useState } from "react"
import { BookingDetailPage } from "@/components/voyant/bookings/booking-detail-page"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getAvailabilityContextValue } from "@/lib/availability-context"

export const Route = createFileRoute("/_workspace/availability/$id")({
  loader: ({ context, params }) =>
    loadAvailabilitySlotDetailPage(context.queryClient, getAvailabilityContextValue(), params.id),
  pendingComponent: AvailabilitySlotDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const messages = useAdminMessages()
  const slotPreview = messages.availability.details.slot
  const client = getAvailabilityContextValue()
  const slotQuery = useQuery(getAvailabilitySlotDetailQueryOptions(client, id))
  const slot = slotQuery.data?.data
  const productQuery = useQuery({
    ...getAvailabilitySlotProductQueryOptions(client, slot?.productId ?? null),
    enabled: Boolean(slot?.productId),
  })
  const productName = productQuery.data?.data?.name ?? null
  const [bookingPreviewId, setBookingPreviewId] = useState<string | null>(null)
  const [bookingCreateDefaults, setBookingCreateDefaults] = useState<{
    slotId: string
    productId: string
  } | null>(null)

  useAdminBreadcrumbs([
    { label: messages.availability.title, href: "/availability" },
    ...(slot
      ? [
          {
            label: productName ? `${productName} · ${slot.dateLocal}` : `Slot · ${slot.dateLocal}`,
          },
        ]
      : []),
  ])

  return (
    <>
      <AvailabilitySlotDetailPage
        id={id}
        onBack={() => void navigate({ to: "/availability" })}
        onDeleted={() => void navigate({ to: "/availability" })}
        onOpenProduct={(productId) =>
          void navigate({ to: "/products/$id", params: { id: productId } })
        }
        onOpenStartTime={(startTimeId) =>
          void navigate({
            to: "/availability/start-times/$id",
            params: { id: startTimeId },
          })
        }
        renderAllocation={({ slotId }) => (
          <SlotAllocationPage
            slotId={slotId}
            embed
            onBookingOpen={(bookingId) => setBookingPreviewId(bookingId)}
            onCreateBooking={(input) => setBookingCreateDefaults(input)}
          />
        )}
      />

      <BookingCreateDialog
        open={Boolean(bookingCreateDefaults)}
        onOpenChange={(open) => {
          if (!open) setBookingCreateDefaults(null)
        }}
        defaultProductId={bookingCreateDefaults?.productId}
        defaultSlotId={bookingCreateDefaults?.slotId}
        onCreated={(booking) => setBookingPreviewId(booking.id)}
      />

      <Sheet
        open={Boolean(bookingPreviewId)}
        onOpenChange={(next) => {
          if (!next) setBookingPreviewId(null)
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{slotPreview.bookingPreviewTitle}</SheetTitle>
            <SheetDescription className="sr-only">
              {slotPreview.bookingPreviewDescription}
            </SheetDescription>
          </SheetHeader>
          {bookingPreviewId ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <BookingDetailPage id={bookingPreviewId} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
