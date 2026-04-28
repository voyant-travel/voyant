import type { QueryClient } from "@tanstack/react-query"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  defaultFetcher,
  formatDateTime,
  getPickupPointsQueryOptions as getPickupPointsQueryOptionsBase,
  getProductQueryOptions as getProductQueryOptionsBase,
  getSlotAssignmentsQueryOptions as getSlotAssignmentsQueryOptionsBase,
  getSlotBookingsQueryOptions as getSlotBookingsQueryOptionsBase,
  getSlotCloseoutsQueryOptions as getSlotCloseoutsQueryOptionsBase,
  getSlotPickupsQueryOptions as getSlotPickupsQueryOptionsBase,
  getSlotQueryOptions as getSlotQueryOptionsBase,
  getSlotResourcesQueryOptions as getSlotResourcesQueryOptionsBase,
  slotStatusVariant,
} from "@voyantjs/availability-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, CalendarDays, Loader2, Package, Trash2, Truck, Wrench } from "lucide-react"
import { api } from "@/lib/api-client"

const client = { baseUrl: "", fetcher: defaultFetcher }

export async function loadAvailabilitySlotDetailPage(
  ensureQueryData: QueryClient["ensureQueryData"],
  id: string,
) {
  const slotData = await ensureQueryData(getAvailabilitySlotQueryOptions(id))

  return Promise.all([
    Promise.resolve(slotData),
    ensureQueryData(getAvailabilitySlotPickupsQueryOptions(id)),
    ensureQueryData(getAvailabilitySlotCloseoutsQueryOptions(id)),
    ensureQueryData(getAvailabilitySlotAssignmentsQueryOptions(id)),
    ensureQueryData(getAvailabilitySlotResourcesQueryOptions()),
    ensureQueryData(getAvailabilitySlotBookingsQueryOptions()),
    ensureQueryData(getAvailabilitySlotProductQueryOptions(slotData.data.productId)),
    ensureQueryData(getAvailabilitySlotPickupPointsQueryOptions(slotData.data.productId)),
  ])
}

export function getAvailabilitySlotQueryOptions(id: string) {
  return getSlotQueryOptionsBase(client, id)
}

export function getAvailabilitySlotProductQueryOptions(productId: string) {
  return getProductQueryOptionsBase(client, productId)
}

export function getAvailabilitySlotPickupsQueryOptions(id: string) {
  return getSlotPickupsQueryOptionsBase(client, id, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotPickupPointsQueryOptions(productId: string) {
  return getPickupPointsQueryOptionsBase(client, { productId, limit: 25, offset: 0 })
}

export function getAvailabilitySlotCloseoutsQueryOptions(id: string) {
  return getSlotCloseoutsQueryOptionsBase(client, id, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotAssignmentsQueryOptions(id: string) {
  return getSlotAssignmentsQueryOptionsBase(client, id, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotResourcesQueryOptions() {
  return getSlotResourcesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotBookingsQueryOptions() {
  return getSlotBookingsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function AvailabilitySlotDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: slotData, isPending } = useQuery(getAvailabilitySlotQueryOptions(id))

  const slot = slotData?.data

  const productQuery = useQuery({
    ...getAvailabilitySlotProductQueryOptions(slot?.productId ?? ""),
    enabled: Boolean(slot?.productId),
  })

  const slotPickupsQuery = useQuery(getAvailabilitySlotPickupsQueryOptions(id))

  const pickupPointsQuery = useQuery({
    ...getAvailabilitySlotPickupPointsQueryOptions(slot?.productId ?? ""),
    enabled: Boolean(slot?.productId),
  })

  const closeoutsQuery = useQuery(getAvailabilitySlotCloseoutsQueryOptions(id))

  const assignmentsQuery = useQuery(getAvailabilitySlotAssignmentsQueryOptions(id))

  const resourcesQuery = useQuery(getAvailabilitySlotResourcesQueryOptions())

  const bookingsQuery = useQuery(getAvailabilitySlotBookingsQueryOptions())

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/availability/slots/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["availability", "slots"] })
      void navigate({ to: "/availability" })
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!slot) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Slot not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/availability" })}>
          Back to Availability
        </Button>
      </div>
    )
  }

  const pickupPointById = new Map(
    (pickupPointsQuery.data?.data ?? []).map((item) => [item.id, item]),
  )
  const resourceById = new Map((resourcesQuery.data?.data ?? []).map((item) => [item.id, item]))
  const bookingById = new Map((bookingsQuery.data?.data ?? []).map((item) => [item.id, item]))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/availability" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {slot.dateLocal} · {formatDateTime(slot.startsAt)}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={slotStatusVariant[slot.status]} className="capitalize">
              {slot.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline">{slot.timezone}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {slot.productId ? (
            <Button
              variant="outline"
              onClick={() => void navigate({ to: "/products/$id", params: { id: slot.productId } })}
            >
              <Package className="mr-2 h-4 w-4" />
              Open Product
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this slot?")) {
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Slot Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Product:</span>{" "}
              <span>{productQuery.data?.data.name ?? slot.productId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Rule:</span>{" "}
              <span>{slot.availabilityRuleId ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Start Time ID:</span>{" "}
              {slot.startTimeId ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    void navigate({
                      to: "/availability/start-times/$id",
                      params: { id: slot.startTimeId! },
                    })
                  }
                >
                  {slot.startTimeId}
                </Button>
              ) : (
                <span>-</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Ends At:</span>{" "}
              <span>{formatDateTime(slot.endsAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Unlimited:</span>{" "}
              <span>{slot.unlimited ? "Yes" : "No"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Past Cutoff:</span>{" "}
              <span>{slot.pastCutoff ? "Yes" : "No"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Too Early:</span>{" "}
              <span>{slot.tooEarly ? "Yes" : "No"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity State</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Initial Pax:</span>{" "}
              <span>{slot.initialPax ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining Pax:</span>{" "}
              <span>{slot.remainingPax ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Initial Pickups:</span>{" "}
              <span>{slot.initialPickups ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining Pickups:</span>{" "}
              <span>{slot.remainingPickups ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining Resources:</span>{" "}
              <span>{slot.remainingResources ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(slot.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              <span>{new Date(slot.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {slot.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{slot.notes}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Truck className="h-4 w-4" />
          <CardTitle>Pickup Capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(slotPickupsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No pickup capacity records for this slot.</p>
          ) : (
            slotPickupsQuery.data?.data.map((pickup) => {
              const point = pickupPointById.get(pickup.pickupPointId)
              return (
                <div key={pickup.id} className="rounded-md border p-3">
                  <div className="font-medium">{point?.name ?? pickup.pickupPointId}</div>
                  <div className="text-muted-foreground">
                    {point?.locationText ?? "No location text"}
                  </div>
                  <div className="mt-2">
                    Initial: {pickup.initialCapacity ?? "-"} · Remaining:{" "}
                    {pickup.remainingCapacity ?? "-"}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wrench className="h-4 w-4" />
          <CardTitle>Resource Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(assignmentsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No resource assignments linked to this slot.</p>
          ) : (
            assignmentsQuery.data?.data.map((assignment) => (
              <div key={assignment.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {assignment.status}
                  </Badge>
                  <span>
                    {resourceById.get(assignment.resourceId ?? "")?.name ??
                      assignment.resourceId ??
                      "Unassigned resource"}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  Booking:{" "}
                  {bookingById.get(assignment.bookingId ?? "")?.bookingNumber ??
                    assignment.bookingId ??
                    "-"}
                </div>
                <div className="text-muted-foreground">
                  Pool: {assignment.poolId ?? "-"} · Released:{" "}
                  {formatDateTime(assignment.releasedAt)}
                </div>
                {assignment.notes ? (
                  <div className="mt-2 whitespace-pre-wrap">{assignment.notes}</div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <CardTitle>Related Closeouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(closeoutsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No closeouts attached directly to this slot.</p>
          ) : (
            closeoutsQuery.data?.data.map((closeout) => (
              <div key={closeout.id} className="rounded-md border p-3">
                <div className="font-medium">{closeout.dateLocal}</div>
                <div className="text-muted-foreground">Created by: {closeout.createdBy ?? "-"}</div>
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
