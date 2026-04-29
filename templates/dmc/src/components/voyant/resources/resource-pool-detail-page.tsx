import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Loader2, Package, Trash2, Users, Wrench } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import {
  getAllocationModeLabel,
  getAssignmentStatusLabel,
  getResourceKindLabel,
} from "./resources-shared"

type PoolDetail = {
  id: string
  productId: string | null
  kind: "guide" | "vehicle" | "room" | "boat" | "equipment" | "other"
  name: string
  sharedCapacity: number | null
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

type Product = { id: string; name: string }
type PoolMember = { id: string; resourceId: string }
type Resource = { id: string; name: string; kind: string; active: boolean }
type Allocation = {
  id: string
  productId: string
  availabilityRuleId: string | null
  startTimeId: string | null
  quantityRequired: number
  allocationMode: "shared" | "exclusive"
  priority: number
}
type Assignment = {
  id: string
  slotId: string
  resourceId: string | null
  bookingId: string | null
  status: "reserved" | "assigned" | "released" | "cancelled" | "completed"
}
type Slot = { id: string; dateLocal: string; startsAt: string }
type Booking = { id: string; bookingNumber: string }
type ListResponse<T> = { data: T[]; total: number; limit: number; offset: number }

export function getResourcePoolDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-pool", id],
    queryFn: () => api.get<{ data: PoolDetail }>(`/v1/resources/pools/${id}`),
  })
}

export function getResourcePoolProductQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["resource-pool-product", productId],
    queryFn: () => api.get<{ data: Product }>(`/v1/products/${productId}`),
  })
}

export function getResourcePoolMembersQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-pool-members", id],
    queryFn: () =>
      api.get<ListResponse<PoolMember>>(`/v1/resources/pool-members?poolId=${id}&limit=25`),
  })
}

export function getResourcePoolResourcesQueryOptions() {
  return queryOptions({
    queryKey: ["resource-pool-resources"],
    queryFn: () => api.get<ListResponse<Resource>>("/v1/resources/resources?limit=25"),
  })
}

export function getResourcePoolAllocationsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-pool-allocations", id],
    queryFn: () =>
      api.get<ListResponse<Allocation>>(`/v1/resources/allocations?poolId=${id}&limit=25`),
  })
}

export function getResourcePoolAssignmentsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-pool-assignments", id],
    queryFn: () =>
      api.get<ListResponse<Assignment>>(`/v1/resources/slot-assignments?poolId=${id}&limit=25`),
  })
}

export function getResourcePoolSlotsQueryOptions() {
  return queryOptions({
    queryKey: ["resource-pool-slots"],
    queryFn: () => api.get<ListResponse<Slot>>("/v1/availability/slots?limit=25"),
  })
}

export function getResourcePoolBookingsQueryOptions() {
  return queryOptions({
    queryKey: ["resource-pool-bookings"],
    queryFn: () => api.get<ListResponse<Booking>>("/v1/bookings?limit=25"),
  })
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16)
}

export async function ensureResourcePoolDetailPageData(queryClient: QueryClient, id: string) {
  const poolData = await queryClient.ensureQueryData(getResourcePoolDetailQueryOptions(id))

  await Promise.all([
    queryClient.ensureQueryData(getResourcePoolMembersQueryOptions(id)),
    queryClient.ensureQueryData(getResourcePoolResourcesQueryOptions()),
    queryClient.ensureQueryData(getResourcePoolAllocationsQueryOptions(id)),
    queryClient.ensureQueryData(getResourcePoolAssignmentsQueryOptions(id)),
    queryClient.ensureQueryData(getResourcePoolSlotsQueryOptions()),
    queryClient.ensureQueryData(getResourcePoolBookingsQueryOptions()),
    ...(poolData.data.productId
      ? [queryClient.ensureQueryData(getResourcePoolProductQueryOptions(poolData.data.productId))]
      : []),
  ])
}

export function ResourcePoolDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages()
  const detailMessages = messages.resources.details
  const noValue = detailMessages.noValue

  const { data: poolData, isPending } = useQuery(getResourcePoolDetailQueryOptions(id))

  const pool = poolData?.data

  const productQuery = useQuery({
    ...getResourcePoolProductQueryOptions(pool?.productId ?? ""),
    enabled: Boolean(pool?.productId),
  })
  const membersQuery = useQuery(getResourcePoolMembersQueryOptions(id))
  const resourcesQuery = useQuery(getResourcePoolResourcesQueryOptions())
  const allocationsQuery = useQuery(getResourcePoolAllocationsQueryOptions(id))
  const assignmentsQuery = useQuery(getResourcePoolAssignmentsQueryOptions(id))
  const slotsQuery = useQuery(getResourcePoolSlotsQueryOptions())
  const bookingsQuery = useQuery(getResourcePoolBookingsQueryOptions())

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/resources/pools/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resources", "pools"] })
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

  if (!pool) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.pool.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/resources" })}>
          {detailMessages.backToResources}
        </Button>
      </div>
    )
  }

  const resourcesById = new Map(
    (resourcesQuery.data?.data ?? []).map((resource) => [resource.id, resource]),
  )
  const slotsById = new Map((slotsQuery.data?.data ?? []).map((slot) => [slot.id, slot]))
  const bookingsById = new Map(
    (bookingsQuery.data?.data ?? []).map((booking) => [booking.id, booking]),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/resources" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{pool.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {getResourceKindLabel(pool.kind, messages)}
            </Badge>
            <Badge variant={pool.active ? "default" : "secondary"}>
              {pool.active ? messages.resources.activeLabel : messages.resources.inactiveLabel}
            </Badge>
          </div>
        </div>
        {pool.productId ? (
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/products/$id", params: { id: pool.productId! } })}
          >
            <Package className="mr-2 h-4 w-4" />
            {detailMessages.openProduct}
          </Button>
        ) : null}
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm(detailMessages.pool.deleteConfirm)) {
              deleteMutation.mutate()
            }
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {detailMessages.delete}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.pool.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.resources.productLabel}:</span>{" "}
              <span>{productQuery.data?.data.name ?? pool.productId ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {messages.resources.dialogs.pool.sharedCapacityLabel}:
              </span>{" "}
              <span>{pool.sharedCapacity ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.resources.createdLabel}:</span>{" "}
              <span>{new Date(pool.createdAt).toLocaleString(resolvedLocale)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.resources.updatedLabel}:</span>{" "}
              <span>{new Date(pool.updatedAt).toLocaleString(resolvedLocale)}</span>
            </div>
          </CardContent>
        </Card>

        {pool.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>{messages.resources.notesTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{pool.notes}</CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Users className="h-4 w-4" />
          <CardTitle>{detailMessages.pool.membersTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(membersQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.pool.membersEmpty}</p>
          ) : (
            membersQuery.data?.data.map((member) => {
              const resource = resourcesById.get(member.resourceId)
              return (
                <button
                  key={member.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() =>
                    resource
                      ? void navigate({ to: "/resources/$id", params: { id: resource.id } })
                      : undefined
                  }
                >
                  <div className="font-medium">{resource?.name ?? member.resourceId}</div>
                  <div className="text-muted-foreground">
                    {resource
                      ? getResourceKindLabel(resource.kind as PoolDetail["kind"], messages)
                      : detailMessages.pool.noResourcesFallback}{" "}
                    ·{" "}
                    {resource?.active
                      ? messages.resources.activeLabel
                      : messages.resources.inactiveLabel}
                  </div>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Package className="h-4 w-4" />
          <CardTitle>{detailMessages.pool.allocationsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(allocationsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.pool.allocationsEmpty}</p>
          ) : (
            allocationsQuery.data?.data.map((allocation) => (
              <button
                key={allocation.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() =>
                  void navigate({
                    to: "/resources/allocations/$id",
                    params: { id: allocation.id },
                  })
                }
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {getAllocationModeLabel(allocation.allocationMode, messages)}
                  </Badge>
                  <span>
                    {detailMessages.quantityPrefix} {allocation.quantityRequired}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  {messages.resources.productLabel}: {allocation.productId}
                </div>
                <div className="text-muted-foreground">
                  {detailMessages.allocation.ruleLabel}:{" "}
                  {allocation.availabilityRuleId ?? detailMessages.noRule} ·{" "}
                  {detailMessages.allocation.startTimeLabel}:{" "}
                  {allocation.startTimeId ?? detailMessages.noStartTime} ·{" "}
                  {detailMessages.pool.priorityLabel}: {allocation.priority}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wrench className="h-4 w-4" />
          <CardTitle>{detailMessages.pool.liveAssignmentsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(assignmentsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.pool.liveAssignmentsEmpty}</p>
          ) : (
            assignmentsQuery.data?.data.map((assignment) => {
              const slot = slotsById.get(assignment.slotId)
              const booking = bookingsById.get(assignment.bookingId ?? "")
              return (
                <button
                  key={assignment.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() =>
                    void navigate({
                      to: "/resources/assignments/$id",
                      params: { id: assignment.id },
                    })
                  }
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {getAssignmentStatusLabel(assignment.status, messages)}
                    </Badge>
                    <span>
                      {slot
                        ? `${slot.dateLocal} · ${formatDateTime(slot.startsAt)}`
                        : assignment.slotId}
                    </span>
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    {messages.resources.bookingLabel}:{" "}
                    {booking?.bookingNumber ?? assignment.bookingId ?? detailMessages.noBooking}
                  </div>
                  <div className="text-muted-foreground">
                    {messages.resources.resourceLabel}:{" "}
                    {assignment.resourceId ?? detailMessages.noResource}
                  </div>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
