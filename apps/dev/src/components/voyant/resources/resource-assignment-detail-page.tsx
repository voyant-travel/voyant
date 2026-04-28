import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, CalendarDays, Loader2, Trash2, Wrench } from "lucide-react"
import { api } from "@/lib/api-client"

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

export async function loadResourceAssignmentDetailPage(
  ensureQueryData: QueryClient["ensureQueryData"],
  id: string,
) {
  const assignmentData = await ensureQueryData(getResourceAssignmentDetailQueryOptions(id))
  const slotData = await ensureQueryData(
    getResourceAssignmentSlotQueryOptions(assignmentData.data.slotId),
  )

  return Promise.all([
    Promise.resolve(assignmentData),
    Promise.resolve(slotData),
    ...(assignmentData.data.poolId
      ? [ensureQueryData(getResourceAssignmentPoolQueryOptions(assignmentData.data.poolId))]
      : []),
    ...(assignmentData.data.resourceId
      ? [ensureQueryData(getResourceAssignmentResourceQueryOptions(assignmentData.data.resourceId))]
      : []),
    ...(assignmentData.data.bookingId
      ? [ensureQueryData(getResourceAssignmentBookingQueryOptions(assignmentData.data.bookingId))]
      : []),
    ...(slotData.data.productId
      ? [ensureQueryData(getResourceAssignmentProductQueryOptions(slotData.data.productId))]
      : []),
  ])
}

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

function formatDateTime(value: string | null) {
  return value ? value.replace("T", " ").slice(0, 16) : "-"
}

export function ResourceAssignmentDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Assignment not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/resources" })}>
          Back to Resources
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
          <h1 className="text-2xl font-bold tracking-tight">Slot Assignment</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {assignment.status}
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
            Open Slot
          </Button>
          {assignment.resourceId ? (
            <Button
              variant="outline"
              onClick={() =>
                void navigate({ to: "/resources/$id", params: { id: assignment.resourceId! } })
              }
            >
              <Wrench className="mr-2 h-4 w-4" />
              Open Resource
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this assignment?")) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Slot:</span>{" "}
            <span>
              {slot ? `${slot.dateLocal} · ${formatDateTime(slot.startsAt)}` : assignment.slotId}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Product:</span>{" "}
            <span>{productQuery.data?.data.name ?? slot?.productId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pool:</span>{" "}
            <span>{poolQuery.data?.data.name ?? assignment.poolId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Resource:</span>{" "}
            <span>{resourceQuery.data?.data.name ?? assignment.resourceId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Booking:</span>{" "}
            <span>{bookingQuery.data?.data.bookingNumber ?? assignment.bookingId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Assigned By:</span>{" "}
            <span>{assignment.assignedBy ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Released:</span>{" "}
            <span>{formatDateTime(assignment.releasedAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            <span>{new Date(assignment.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Updated:</span>{" "}
            <span>{new Date(assignment.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {assignment.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{assignment.notes}</CardContent>
        </Card>
      ) : null}
    </div>
  )
}
