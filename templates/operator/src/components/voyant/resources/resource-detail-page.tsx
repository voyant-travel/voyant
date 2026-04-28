import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { useLocale } from "@voyantjs/voyant-admin"
import { ArrowLeft, Package, Trash2, Users, Wrench } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { ResourceDetailSkeleton } from "./resource-detail-skeleton"
import { getAssignmentStatusLabel, getResourceKindLabel } from "./resources-shared"

type ResourceDetail = {
  id: string
  supplierId: string | null
  kind: "guide" | "vehicle" | "room" | "boat" | "equipment" | "other"
  name: string
  code: string | null
  capacity: number | null
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

type Supplier = { id: string; name: string }
type PoolMember = { id: string; poolId: string; resourceId: string }
type Pool = { id: string; name: string; productId: string | null }
type Assignment = {
  id: string
  slotId: string
  bookingId: string | null
  status: "reserved" | "assigned" | "released" | "cancelled" | "completed"
  assignedBy: string | null
  releasedAt: string | null
  notes: string | null
}
type Slot = { id: string; dateLocal: string; startsAt: string }
type Booking = { id: string; bookingNumber: string }
type Closeout = {
  id: string
  dateLocal: string
  startsAt: string | null
  endsAt: string | null
  reason: string | null
  createdBy: string | null
}

type ListResponse<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
}

export function getResourceDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource", id],
    queryFn: () => api.get<{ data: ResourceDetail }>(`/v1/resources/resources/${id}`),
  })
}

export function getResourceSupplierQueryOptions(supplierId: string) {
  return queryOptions({
    queryKey: ["resource-supplier", supplierId],
    queryFn: () => api.get<{ data: Supplier }>(`/v1/suppliers/${supplierId}`),
  })
}

export function getResourcePoolMembersQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-pool-members", id],
    queryFn: () =>
      api.get<ListResponse<PoolMember>>(`/v1/resources/pool-members?resourceId=${id}&limit=25`),
  })
}

export function getResourcePoolsQueryOptions() {
  return queryOptions({
    queryKey: ["resource-pools"],
    queryFn: () => api.get<ListResponse<Pool>>("/v1/resources/pools?limit=25"),
  })
}

export function getResourceAssignmentsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-assignments", id],
    queryFn: () =>
      api.get<ListResponse<Assignment>>(`/v1/resources/slot-assignments?resourceId=${id}&limit=25`),
  })
}

export function getResourceSlotsQueryOptions() {
  return queryOptions({
    queryKey: ["resource-slots"],
    queryFn: () => api.get<ListResponse<Slot>>("/v1/availability/slots?limit=25"),
  })
}

export function getResourceBookingsQueryOptions() {
  return queryOptions({
    queryKey: ["resource-bookings"],
    queryFn: () => api.get<ListResponse<Booking>>("/v1/bookings?limit=25"),
  })
}

export function getResourceCloseoutsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-closeouts", id],
    queryFn: () =>
      api.get<ListResponse<Closeout>>(`/v1/resources/closeouts?resourceId=${id}&limit=25`),
  })
}

function formatDateTime(value: string | null, noValue: string) {
  return value ? value.replace("T", " ").slice(0, 16) : noValue
}

export async function ensureResourceDetailPageData(queryClient: QueryClient, id: string) {
  const resourceData = await queryClient.ensureQueryData(getResourceDetailQueryOptions(id))

  await Promise.all([
    queryClient.ensureQueryData(getResourcePoolMembersQueryOptions(id)),
    queryClient.ensureQueryData(getResourcePoolsQueryOptions()),
    queryClient.ensureQueryData(getResourceAssignmentsQueryOptions(id)),
    queryClient.ensureQueryData(getResourceSlotsQueryOptions()),
    queryClient.ensureQueryData(getResourceBookingsQueryOptions()),
    queryClient.ensureQueryData(getResourceCloseoutsQueryOptions(id)),
    ...(resourceData.data.supplierId
      ? [queryClient.ensureQueryData(getResourceSupplierQueryOptions(resourceData.data.supplierId))]
      : []),
  ])
}

export function ResourceDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages()
  const detailMessages = messages.resources.details
  const noValue = detailMessages.noValue

  const { data: resourceData, isPending } = useQuery(getResourceDetailQueryOptions(id))

  const resource = resourceData?.data

  const supplierQuery = useQuery({
    ...getResourceSupplierQueryOptions(resource?.supplierId ?? ""),
    enabled: Boolean(resource?.supplierId),
  })

  const poolMembersQuery = useQuery(getResourcePoolMembersQueryOptions(id))

  const poolsQuery = useQuery(getResourcePoolsQueryOptions())

  const assignmentsQuery = useQuery(getResourceAssignmentsQueryOptions(id))

  const slotsQuery = useQuery(getResourceSlotsQueryOptions())

  const bookingsQuery = useQuery(getResourceBookingsQueryOptions())

  const closeoutsQuery = useQuery(getResourceCloseoutsQueryOptions(id))

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/resources/resources/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resources", "resources"] })
      void navigate({ to: "/resources" })
    },
  })

  if (isPending) {
    return <ResourceDetailSkeleton />
  }

  if (!resource) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.resource.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/resources" })}>
          {detailMessages.backToResources}
        </Button>
      </div>
    )
  }

  const poolsById = new Map((poolsQuery.data?.data ?? []).map((pool) => [pool.id, pool]))
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
          <h1 className="text-2xl font-bold tracking-tight">{resource.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {getResourceKindLabel(resource.kind, messages)}
            </Badge>
            <Badge variant={resource.active ? "default" : "secondary"}>
              {resource.active ? messages.resources.activeLabel : messages.resources.inactiveLabel}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resource.supplierId ? (
            <Button
              variant="outline"
              onClick={() =>
                void navigate({ to: "/suppliers/$id", params: { id: resource.supplierId! } })
              }
            >
              <Users className="mr-2 h-4 w-4" />
              {detailMessages.openSupplier}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.resource.deleteConfirm)) {
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.resource.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.resources.supplierLabel}:</span>{" "}
              <span>
                {supplierQuery.data?.data.name ??
                  (resource.supplierId
                    ? resource.supplierId
                    : detailMessages.resource.noSupplierAssigned)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {messages.resources.dialogs.resource.codeLabel}:
              </span>{" "}
              <span>{resource.code ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.resources.capacityLabel}:</span>{" "}
              <span>{resource.capacity ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.resources.createdLabel}:</span>{" "}
              <span>{new Date(resource.createdAt).toLocaleString(resolvedLocale)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.resources.updatedLabel}:</span>{" "}
              <span>{new Date(resource.updatedAt).toLocaleString(resolvedLocale)}</span>
            </div>
          </CardContent>
        </Card>

        {resource.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>{messages.resources.notesTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{resource.notes}</CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Package className="h-4 w-4" />
          <CardTitle>{detailMessages.resource.poolMembershipsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(poolMembersQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.resource.poolMembershipsEmpty}</p>
          ) : (
            poolMembersQuery.data?.data.map((member) => (
              <div key={member.id} className="rounded-md border p-3">
                <div className="font-medium">
                  {poolsById.get(member.poolId)?.name ?? member.poolId}
                </div>
                <div className="text-muted-foreground">
                  {messages.resources.productLabel}:{" "}
                  {poolsById.get(member.poolId)?.productId ?? noValue}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wrench className="h-4 w-4" />
          <CardTitle>{detailMessages.resource.assignmentsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(assignmentsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.resource.assignmentsEmpty}</p>
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
                        ? `${slot.dateLocal} · ${formatDateTime(slot.startsAt, noValue)}`
                        : assignment.slotId}
                    </span>
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    {messages.resources.bookingLabel}:{" "}
                    {booking?.bookingNumber ?? assignment.bookingId ?? detailMessages.noBooking}
                  </div>
                  <div className="text-muted-foreground">
                    {detailMessages.resource.assignedByLabel}: {assignment.assignedBy ?? noValue} ·{" "}
                    {detailMessages.resource.releasedLabel}:{" "}
                    {formatDateTime(assignment.releasedAt, noValue)}
                  </div>
                  {assignment.notes ? (
                    <div className="mt-2 whitespace-pre-wrap">{assignment.notes}</div>
                  ) : null}
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{detailMessages.resource.closeoutsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(closeoutsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.resource.closeoutsEmpty}</p>
          ) : (
            closeoutsQuery.data?.data.map((closeout) => (
              <div key={closeout.id} className="rounded-md border p-3">
                <div className="font-medium">{closeout.dateLocal}</div>
                <div className="text-muted-foreground">
                  {formatDateTime(closeout.startsAt, noValue)} to{" "}
                  {formatDateTime(closeout.endsAt, noValue)}
                </div>
                <div className="text-muted-foreground">
                  {detailMessages.resource.createdByLabel}: {closeout.createdBy ?? noValue}
                </div>
                {closeout.reason ? (
                  <div className="mt-2 whitespace-pre-wrap">{closeout.reason}</div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
