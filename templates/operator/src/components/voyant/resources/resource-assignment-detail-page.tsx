import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { useLocale } from "@voyantjs/voyant-admin"
import { ArrowLeft, CalendarDays, Trash2, Wrench } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { ResourceAssignmentDetailSkeleton } from "./resource-assignment-detail-skeleton"
import { getAssignmentStatusLabel } from "./resources-shared"

type AssignmentDetail = {
  id: string
  slotId: string
  poolId: string | null
  resourceId: string | null
  bookingId: string | null
  status: "reserved" | "assigned" | "released" | "cancelled" | "completed"
  assignedBy: string | null
  releasedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

type Slot = { id: string; productId: string; dateLocal: string; startsAt: string }
type Pool = { id: string; name: string }
type Resource = { id: string; name: string }
type Booking = { id: string; bookingNumber: string }
type Product = { id: string; name: string }

export function getResourceAssignmentDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-assignment", id],
    queryFn: () => api.get<{ data: AssignmentDetail }>(`/v1/resources/slot-assignments/${id}`),
  })
}

export function getResourceAssignmentSlotQueryOptions(slotId: string) {
  return queryOptions({
    queryKey: ["resource-assignment-slot", slotId],
    queryFn: () => api.get<{ data: Slot }>(`/v1/availability/slots/${slotId}`),
  })
}

export function getResourceAssignmentPoolQueryOptions(poolId: string) {
  return queryOptions({
    queryKey: ["resource-assignment-pool", poolId],
    queryFn: () => api.get<{ data: Pool }>(`/v1/resources/pools/${poolId}`),
  })
}

export function getResourceAssignmentResourceQueryOptions(resourceId: string) {
  return queryOptions({
    queryKey: ["resource-assignment-resource", resourceId],
    queryFn: () => api.get<{ data: Resource }>(`/v1/resources/resources/${resourceId}`),
  })
}

export function getResourceAssignmentBookingQueryOptions(bookingId: string) {
  return queryOptions({
    queryKey: ["resource-assignment-booking", bookingId],
    queryFn: () => api.get<{ data: Booking }>(`/v1/bookings/${bookingId}`),
  })
}

export function getResourceAssignmentProductQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["resource-assignment-product", productId],
    queryFn: () => api.get<{ data: Product }>(`/v1/products/${productId}`),
  })
}

function formatDateTime(value: string | null, noValue: string) {
  return value ? value.replace("T", " ").slice(0, 16) : noValue
}

export async function ensureResourceAssignmentDetailPageData(queryClient: QueryClient, id: string) {
  const assignmentData = await queryClient.ensureQueryData(
    getResourceAssignmentDetailQueryOptions(id),
  )
  const slotData = await queryClient.ensureQueryData(
    getResourceAssignmentSlotQueryOptions(assignmentData.data.slotId),
  )

  await Promise.all([
    ...(assignmentData.data.poolId
      ? [
          queryClient.ensureQueryData(
            getResourceAssignmentPoolQueryOptions(assignmentData.data.poolId),
          ),
        ]
      : []),
    ...(assignmentData.data.resourceId
      ? [
          queryClient.ensureQueryData(
            getResourceAssignmentResourceQueryOptions(assignmentData.data.resourceId),
          ),
        ]
      : []),
    ...(assignmentData.data.bookingId
      ? [
          queryClient.ensureQueryData(
            getResourceAssignmentBookingQueryOptions(assignmentData.data.bookingId),
          ),
        ]
      : []),
    ...(slotData.data.productId
      ? [
          queryClient.ensureQueryData(
            getResourceAssignmentProductQueryOptions(slotData.data.productId),
          ),
        ]
      : []),
  ])
}

export function ResourceAssignmentDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages()
  const detailMessages = messages.resources.details
  const noValue = detailMessages.noValue

  const { data: assignmentData, isPending } = useQuery(getResourceAssignmentDetailQueryOptions(id))

  const assignment = assignmentData?.data

  const slotQuery = useQuery({
    ...getResourceAssignmentSlotQueryOptions(assignment?.slotId ?? ""),
    enabled: Boolean(assignment?.slotId),
  })

  const poolQuery = useQuery({
    ...getResourceAssignmentPoolQueryOptions(assignment?.poolId ?? ""),
    enabled: Boolean(assignment?.poolId),
  })

  const resourceQuery = useQuery({
    ...getResourceAssignmentResourceQueryOptions(assignment?.resourceId ?? ""),
    enabled: Boolean(assignment?.resourceId),
  })

  const bookingQuery = useQuery({
    ...getResourceAssignmentBookingQueryOptions(assignment?.bookingId ?? ""),
    enabled: Boolean(assignment?.bookingId),
  })

  const productQuery = useQuery({
    ...getResourceAssignmentProductQueryOptions(slotQuery.data?.data.productId ?? ""),
    enabled: Boolean(slotQuery.data?.data.productId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/resources/slot-assignments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resources", "assignments"] })
      void navigate({ to: "/resources" })
    },
  })

  if (isPending) {
    return <ResourceAssignmentDetailSkeleton />
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.assignment.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/resources" })}>
          {detailMessages.backToResources}
        </Button>
      </div>
    )
  }

  const slot = slotQuery.data?.data

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/resources" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {detailMessages.assignment.pageTitle}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {getAssignmentStatusLabel(assignment.status, messages)}
            </Badge>
            <Badge variant="secondary">{slot ? `${slot.dateLocal}` : assignment.slotId}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/availability/$id", params: { id: assignment.slotId } })
            }
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            {detailMessages.openSlot}
          </Button>
          {assignment.resourceId ? (
            <Button
              variant="outline"
              onClick={() =>
                void navigate({ to: "/resources/$id", params: { id: assignment.resourceId! } })
              }
            >
              <Wrench className="mr-2 h-4 w-4" />
              {detailMessages.openResource}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.assignment.deleteConfirm)) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {detailMessages.delete}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{detailMessages.assignment.detailsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{messages.resources.slotLabel}:</span>{" "}
            <span>
              {slot
                ? `${slot.dateLocal} · ${formatDateTime(slot.startsAt, noValue)}`
                : assignment.slotId}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.productLabel}:</span>{" "}
            <span>{productQuery.data?.data.name ?? slot?.productId ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.poolLabel}:</span>{" "}
            <span>{poolQuery.data?.data.name ?? assignment.poolId ?? detailMessages.noPool}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.resourceLabel}:</span>{" "}
            <span>
              {resourceQuery.data?.data.name ?? assignment.resourceId ?? detailMessages.noResource}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.bookingLabel}:</span>{" "}
            <span>
              {bookingQuery.data?.data.bookingNumber ??
                assignment.bookingId ??
                detailMessages.noBooking}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {detailMessages.assignment.assignedByLabel}:
            </span>{" "}
            <span>{assignment.assignedBy ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {detailMessages.assignment.releasedLabel}:
            </span>{" "}
            <span>{formatDateTime(assignment.releasedAt, noValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.createdLabel}:</span>{" "}
            <span>{new Date(assignment.createdAt).toLocaleString(resolvedLocale)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.updatedLabel}:</span>{" "}
            <span>{new Date(assignment.updatedAt).toLocaleString(resolvedLocale)}</span>
          </div>
        </CardContent>
      </Card>

      {assignment.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.resources.notesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{assignment.notes}</CardContent>
        </Card>
      ) : null}
    </div>
  )
}
