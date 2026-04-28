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
import { useLocale } from "@voyantjs/voyant-admin"
import { ArrowLeft, CalendarDays, Loader2, Package, Trash2, Truck, Wrench } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { getSlotStatusLabel } from "./availability-shared"

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
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages()
  const detailMessages = messages.availability.details
  const noValue = detailMessages.noValue

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
        <p className="text-muted-foreground">{detailMessages.slot.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/availability" })}>
          {detailMessages.backToAvailability}
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
            <Badge variant={slotStatusVariant[slot.status]}>
              {getSlotStatusLabel(slot.status, messages)}
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
              {detailMessages.openProduct}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.slot.deleteConfirm)) {
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
            <CardTitle>{detailMessages.slot.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.availability.productLabel}:</span>{" "}
              <span>{productQuery.data?.data.name ?? slot.productId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.slot.ruleLabel}:</span>{" "}
              <span>{slot.availabilityRuleId ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.slot.startTimeIdLabel}:</span>{" "}
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
                <span>{noValue}</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.slot.endsAtLabel}:</span>{" "}
              <span>{formatDateTime(slot.endsAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.slot.unlimitedLabel}:</span>{" "}
              <span>{slot.unlimited ? detailMessages.yes : detailMessages.no}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.slot.pastCutoffLabel}:</span>{" "}
              <span>{slot.pastCutoff ? detailMessages.yes : detailMessages.no}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.slot.tooEarlyLabel}:</span>{" "}
              <span>{slot.tooEarly ? detailMessages.yes : detailMessages.no}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.slot.capacityStateTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{detailMessages.slot.initialPaxLabel}:</span>{" "}
              <span>{slot.initialPax ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {messages.availability.remainingPaxLabel}:
              </span>{" "}
              <span>{slot.remainingPax ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.slot.initialPickupsLabel}:
              </span>{" "}
              <span>{slot.initialPickups ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.slot.remainingPickupsLabel}:
              </span>{" "}
              <span>{slot.remainingPickups ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.slot.remainingResourcesLabel}:
              </span>{" "}
              <span>{slot.remainingResources ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.createdLabel}:</span>{" "}
              <span>{new Date(slot.createdAt).toLocaleString(resolvedLocale)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.updatedLabel}:</span>{" "}
              <span>{new Date(slot.updatedAt).toLocaleString(resolvedLocale)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {slot.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.notesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{slot.notes}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Truck className="h-4 w-4" />
          <CardTitle>{detailMessages.slot.pickupCapacityTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(slotPickupsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.slot.pickupCapacityEmpty}</p>
          ) : (
            slotPickupsQuery.data?.data.map((pickup) => {
              const point = pickupPointById.get(pickup.pickupPointId)
              return (
                <div key={pickup.id} className="rounded-md border p-3">
                  <div className="font-medium">{point?.name ?? pickup.pickupPointId}</div>
                  <div className="text-muted-foreground">
                    {point?.locationText ?? detailMessages.slot.noLocationText}
                  </div>
                  <div className="mt-2">
                    {detailMessages.slot.initialLabel}: {pickup.initialCapacity ?? noValue} ·{" "}
                    {detailMessages.slot.remainingLabel}: {pickup.remainingCapacity ?? noValue}
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
          <CardTitle>{detailMessages.slot.resourceAssignmentsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(assignmentsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.slot.resourceAssignmentsEmpty}</p>
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
                      detailMessages.slot.unassignedResource}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  {detailMessages.slot.bookingLabel}:{" "}
                  {bookingById.get(assignment.bookingId ?? "")?.bookingNumber ??
                    assignment.bookingId ??
                    noValue}
                </div>
                <div className="text-muted-foreground">
                  {detailMessages.slot.poolLabel}: {assignment.poolId ?? noValue} ·{" "}
                  {detailMessages.slot.releasedLabel}: {formatDateTime(assignment.releasedAt)}
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
          <CardTitle>{detailMessages.slot.relatedCloseoutsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(closeoutsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.slot.relatedCloseoutsEmpty}</p>
          ) : (
            closeoutsQuery.data?.data.map((closeout) => (
              <div key={closeout.id} className="rounded-md border p-3">
                <div className="font-medium">{closeout.dateLocal}</div>
                <div className="text-muted-foreground">
                  {detailMessages.slot.createdByLabel}: {closeout.createdBy ?? noValue}
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
