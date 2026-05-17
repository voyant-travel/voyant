import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import {
  AvailabilityStartTimeDetailPage,
  AvailabilityStartTimeDetailSkeleton,
  getAvailabilityStartTimeDetailQueryOptions,
  loadAvailabilityStartTimeDetailPage,
} from "@voyantjs/availability-ui"
import { getAvailabilityContextValue } from "@/lib/availability-context"

export const Route = createFileRoute("/_workspace/availability/start-times/$id")({
  loader: ({ context, params }) =>
    loadAvailabilityStartTimeDetailPage(
      context.queryClient,
      getAvailabilityContextValue(),
      params.id,
    ),
  pendingComponent: AvailabilityStartTimeDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const client = getAvailabilityContextValue()
  const startTimeQuery = useQuery(getAvailabilityStartTimeDetailQueryOptions(client, id))
  const startTime = startTimeQuery.data?.data

  useAdminBreadcrumbs([
    { label: "Availability", href: "/availability" },
    ...(startTime
      ? [
          {
            label: startTime.label
              ? `${startTime.productName ?? "Start time"} · ${startTime.label}`
              : (startTime.productName ?? `Start time ${startTime.startTimeLocal}`),
          },
        ]
      : []),
  ])

  return (
    <AvailabilityStartTimeDetailPage
      id={id}
      onBack={() => void navigate({ to: "/availability" })}
      onDeleted={() => void navigate({ to: "/availability" })}
      onOpenProduct={(productId) =>
        void navigate({ to: "/products/$id", params: { id: productId } })
      }
      onOpenSlot={(slotId) => void navigate({ to: "/availability/$id", params: { id: slotId } })}
    />
  )
}
