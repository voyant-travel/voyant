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
  const client = getAvailabilityContextValue()
  const slotQuery = useQuery(getAvailabilitySlotDetailQueryOptions(client, id))
  const slot = slotQuery.data?.data
  const productQuery = useQuery({
    ...getAvailabilitySlotProductQueryOptions(client, slot?.productId ?? null),
    enabled: Boolean(slot?.productId),
  })
  const productName = productQuery.data?.data?.name ?? null

  useAdminBreadcrumbs([
    { label: "Availability", href: "/availability" },
    ...(slot
      ? [
          {
            label: productName ? `${productName} · ${slot.dateLocal}` : `Slot · ${slot.dateLocal}`,
          },
        ]
      : []),
  ])

  return (
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
      renderAllocation={({ slotId }) => <SlotAllocationPage slotId={slotId} embed />}
    />
  )
}
