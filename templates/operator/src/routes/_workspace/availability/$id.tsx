import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { SlotAllocationPage } from "@voyantjs/allocation-ui"
import { useRules, useStartTimes } from "@voyantjs/availability-react"
import {
  AvailabilitySlotDetailPage,
  AvailabilitySlotDetailSkeleton,
  getAvailabilitySlotDetailQueryOptions,
  getAvailabilitySlotProductQueryOptions,
  loadAvailabilitySlotDetailPage,
} from "@voyantjs/availability-ui"
import { BookingCreateSheet, BookingQuickViewSheet } from "@voyantjs/bookings-ui"
import { ProductQuickViewSheet } from "@voyantjs/products-ui"
import { useState } from "react"
import { AvailabilitySlotDialog } from "@/components/voyant/availability/availability-dialogs"
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
  const client = getAvailabilityContextValue()
  const slotQuery = useQuery(getAvailabilitySlotDetailQueryOptions(client, id))
  const slot = slotQuery.data?.data
  const productQuery = useQuery({
    ...getAvailabilitySlotProductQueryOptions(client, slot?.productId ?? null),
    enabled: Boolean(slot?.productId),
  })
  const productName = productQuery.data?.data?.name ?? null
  const [bookingPreviewId, setBookingPreviewId] = useState<string | null>(null)
  const [productPreviewId, setProductPreviewId] = useState<string | null>(null)
  const [bookingCreateDefaults, setBookingCreateDefaults] = useState<{
    slotId: string
    productId: string
  } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  // Lazy-load rules + start times only when the edit dialog opens —
  // the slot detail view itself doesn't need them. Scope to the slot's
  // product so the dialog only suggests recurring rules / start times
  // that already belong to this product.
  const rulesQuery = useRules({ productId: slot?.productId, enabled: editDialogOpen })
  const startTimesQuery = useStartTimes({
    productId: slot?.productId,
    enabled: editDialogOpen,
  })

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
        onOpenProduct={(productId) => setProductPreviewId(productId)}
        onOpenStartTime={(startTimeId) =>
          void navigate({
            to: "/availability/start-times/$id",
            params: { id: startTimeId },
          })
        }
        onCreateBooking={(input) => setBookingCreateDefaults(input)}
        onEdit={() => setEditDialogOpen(true)}
        renderAllocation={({ slotId }) => (
          <SlotAllocationPage
            slotId={slotId}
            embed
            onBookingOpen={(bookingId) => setBookingPreviewId(bookingId)}
          />
        )}
      />

      <BookingCreateSheet
        open={Boolean(bookingCreateDefaults)}
        onOpenChange={(open) => {
          if (!open) setBookingCreateDefaults(null)
        }}
        defaultProductId={bookingCreateDefaults?.productId}
        defaultSlotId={bookingCreateDefaults?.slotId}
        onCreated={(booking) => setBookingPreviewId(booking.id)}
      />

      <BookingQuickViewSheet
        bookingId={bookingPreviewId}
        open={bookingPreviewId !== null}
        onOpenChange={(open) => {
          if (!open) setBookingPreviewId(null)
        }}
        onViewFull={(booking) => {
          setBookingPreviewId(null)
          void navigate({ to: "/bookings/$id", params: { id: booking.id } })
        }}
      />

      <ProductQuickViewSheet
        productId={productPreviewId}
        open={productPreviewId !== null}
        onOpenChange={(open) => {
          if (!open) setProductPreviewId(null)
        }}
        onViewFull={(product) => {
          setProductPreviewId(null)
          void navigate({ to: "/products/$id", params: { id: product.id } })
        }}
      />

      {slot && productQuery.data?.data ? (
        <AvailabilitySlotDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          slot={slot}
          products={[productQuery.data.data]}
          rules={rulesQuery.data?.data ?? []}
          startTimes={startTimesQuery.data?.data ?? []}
          onSuccess={() => {
            setEditDialogOpen(false)
            void slotQuery.refetch()
          }}
        />
      ) : null}
    </>
  )
}
