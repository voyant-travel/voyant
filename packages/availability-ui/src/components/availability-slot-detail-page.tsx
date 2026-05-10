"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import {
  type AvailabilitySlotRow,
  formatDateTime,
  getPickupPointsQueryOptions,
  getProductQueryOptions,
  getSlotAssignmentsQueryOptions,
  getSlotBookingsQueryOptions,
  getSlotCloseoutsQueryOptions,
  getSlotPickupsQueryOptions,
  getSlotQueryOptions,
  getSlotResourcesQueryOptions,
  slotStatusVariant,
  useAvailabilitySlotMutation,
  useVoyantAvailabilityContext,
  type VoyantAvailabilityContextValue,
} from "@voyantjs/availability-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@voyantjs/ui/components"
import { ArrowLeft, CalendarDays, Package, Trash2, Truck, Wrench } from "lucide-react"
import type { ReactNode } from "react"

import { useAvailabilityUiI18nOrDefault } from "../i18n/index.js"
import { getSlotStatusLabel } from "./availability-columns.js"
import { AvailabilitySlotDetailSkeleton } from "./availability-skeletons.js"

export interface AvailabilitySlotDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onOpenProduct?: (productId: string) => void
  onOpenStartTime?: (startTimeId: string) => void
  confirmAction?: (message: string) => boolean
}

export function getAvailabilitySlotDetailQueryOptions(
  client: VoyantAvailabilityContextValue,
  id: string | null | undefined,
) {
  return getSlotQueryOptions(client, id)
}

export function getAvailabilitySlotProductQueryOptions(
  client: VoyantAvailabilityContextValue,
  productId: string | null | undefined,
) {
  return getProductQueryOptions(client, productId)
}

export function getAvailabilitySlotPickupsQueryOptions(
  client: VoyantAvailabilityContextValue,
  id: string | null | undefined,
) {
  return getSlotPickupsQueryOptions(client, id, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotPickupPointsQueryOptions(
  client: VoyantAvailabilityContextValue,
  productId: string | null | undefined,
) {
  return getPickupPointsQueryOptions(client, {
    productId: productId ?? undefined,
    limit: 25,
    offset: 0,
  })
}

export function getAvailabilitySlotCloseoutsQueryOptions(
  client: VoyantAvailabilityContextValue,
  id: string | null | undefined,
) {
  return getSlotCloseoutsQueryOptions(client, id, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotAssignmentsQueryOptions(
  client: VoyantAvailabilityContextValue,
  id: string | null | undefined,
) {
  return getSlotAssignmentsQueryOptions(client, id, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotResourcesQueryOptions(client: VoyantAvailabilityContextValue) {
  return getSlotResourcesQueryOptions(client, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotBookingsQueryOptions(client: VoyantAvailabilityContextValue) {
  return getSlotBookingsQueryOptions(client, { limit: 25, offset: 0 })
}

export async function loadAvailabilitySlotDetailPage(
  queryClient: QueryClient,
  client: VoyantAvailabilityContextValue,
  id: string,
) {
  const slotData = await queryClient.ensureQueryData(
    getAvailabilitySlotDetailQueryOptions(client, id),
  )

  return Promise.all([
    Promise.resolve(slotData),
    queryClient.ensureQueryData(getAvailabilitySlotPickupsQueryOptions(client, id)),
    queryClient.ensureQueryData(getAvailabilitySlotCloseoutsQueryOptions(client, id)),
    queryClient.ensureQueryData(getAvailabilitySlotAssignmentsQueryOptions(client, id)),
    queryClient.ensureQueryData(getAvailabilitySlotResourcesQueryOptions(client)),
    queryClient.ensureQueryData(getAvailabilitySlotBookingsQueryOptions(client)),
    queryClient.ensureQueryData(
      getAvailabilitySlotProductQueryOptions(client, slotData.data.productId),
    ),
    queryClient.ensureQueryData(
      getAvailabilitySlotPickupPointsQueryOptions(client, slotData.data.productId),
    ),
  ])
}

export function AvailabilitySlotDetailPage({
  id,
  className,
  onBack,
  onDeleted,
  onOpenProduct,
  onOpenStartTime,
  confirmAction = (message) => globalThis.confirm?.(message) ?? true,
}: AvailabilitySlotDetailPageProps) {
  const client = useVoyantAvailabilityContext()
  const i18n = useAvailabilityUiI18nOrDefault()
  const messages = i18n.messages
  const detailMessages = messages.details
  const noValue = detailMessages.noValue
  const slotMutation = useAvailabilitySlotMutation()
  const { data: slotData, isPending } = useQuery(getAvailabilitySlotDetailQueryOptions(client, id))
  const slot = slotData?.data
  const productQuery = useQuery({
    ...getAvailabilitySlotProductQueryOptions(client, slot?.productId ?? ""),
    enabled: Boolean(slot?.productId),
  })
  const slotPickupsQuery = useQuery(getAvailabilitySlotPickupsQueryOptions(client, id))
  const pickupPointsQuery = useQuery({
    ...getAvailabilitySlotPickupPointsQueryOptions(client, slot?.productId ?? ""),
    enabled: Boolean(slot?.productId),
  })
  const closeoutsQuery = useQuery(getAvailabilitySlotCloseoutsQueryOptions(client, id))
  const assignmentsQuery = useQuery(getAvailabilitySlotAssignmentsQueryOptions(client, id))
  const resourcesQuery = useQuery(getAvailabilitySlotResourcesQueryOptions(client))
  const bookingsQuery = useQuery(getAvailabilitySlotBookingsQueryOptions(client))

  if (isPending) {
    return <AvailabilitySlotDetailSkeleton />
  }

  if (!slot) {
    return (
      <DetailEmptyState
        message={detailMessages.slot.notFound}
        backLabel={detailMessages.backToAvailability}
        onBack={onBack}
      />
    )
  }

  const pickupPointById = new Map(
    (pickupPointsQuery.data?.data ?? []).map((item) => [item.id, item]),
  )
  const resourceById = new Map((resourcesQuery.data?.data ?? []).map((item) => [item.id, item]))
  const bookingById = new Map((bookingsQuery.data?.data ?? []).map((item) => [item.id, item]))

  async function deleteSlot(currentSlot: AvailabilitySlotRow) {
    if (!confirmAction(detailMessages.slot.deleteConfirm)) return
    await slotMutation.remove.mutateAsync(currentSlot.id)
    if (onDeleted) onDeleted()
    else onBack?.()
  }

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          {onBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label={detailMessages.backToAvailability}
            >
              <ArrowLeft data-icon aria-hidden="true" />
            </Button>
          ) : null}
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {slot.dateLocal} · {formatDateTime(slot.startsAt)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={slotStatusVariant[slot.status]}>
                {getSlotStatusLabel(slot.status, messages)}
              </Badge>
              <Badge variant="outline">{slot.timezone}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {slot.productId && onOpenProduct ? (
            <Button variant="outline" onClick={() => onOpenProduct(slot.productId)}>
              <Package data-icon="inline-start" aria-hidden="true" />
              {detailMessages.openProduct}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => void deleteSlot(slot)}
            disabled={slotMutation.remove.isPending}
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            {detailMessages.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.slot.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <DetailLine label={messages.productLabel}>
              {productQuery.data?.data.name ?? slot.productId}
            </DetailLine>
            <DetailLine label={detailMessages.slot.ruleLabel}>
              {slot.availabilityRuleId ?? noValue}
            </DetailLine>
            <DetailLine label={detailMessages.slot.startTimeIdLabel}>
              {slot.startTimeId && onOpenStartTime ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => onOpenStartTime(slot.startTimeId ?? "")}
                >
                  {slot.startTimeId}
                </Button>
              ) : (
                (slot.startTimeId ?? noValue)
              )}
            </DetailLine>
            <DetailLine label={detailMessages.slot.endsAtLabel}>
              {formatDateTime(slot.endsAt)}
            </DetailLine>
            <DetailLine label={detailMessages.slot.unlimitedLabel}>
              {slot.unlimited ? detailMessages.yes : detailMessages.no}
            </DetailLine>
            <DetailLine label={detailMessages.slot.pastCutoffLabel}>
              {slot.pastCutoff ? detailMessages.yes : detailMessages.no}
            </DetailLine>
            <DetailLine label={detailMessages.slot.tooEarlyLabel}>
              {slot.tooEarly ? detailMessages.yes : detailMessages.no}
            </DetailLine>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.slot.capacityStateTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <DetailLine label={detailMessages.slot.initialPaxLabel}>
              {slot.initialPax ?? noValue}
            </DetailLine>
            <DetailLine label={messages.remainingPaxLabel}>
              {slot.remainingPax ?? noValue}
            </DetailLine>
            <DetailLine label={detailMessages.slot.initialPickupsLabel}>
              {slot.initialPickups ?? noValue}
            </DetailLine>
            <DetailLine label={detailMessages.slot.remainingPickupsLabel}>
              {slot.remainingPickups ?? noValue}
            </DetailLine>
            <DetailLine label={detailMessages.slot.remainingResourcesLabel}>
              {slot.remainingResources ?? noValue}
            </DetailLine>
            <DetailLine label={detailMessages.createdLabel}>
              {i18n.formatDateTime(slot.createdAt)}
            </DetailLine>
            <DetailLine label={detailMessages.updatedLabel}>
              {i18n.formatDateTime(slot.updatedAt)}
            </DetailLine>
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
          <Truck className="size-4" aria-hidden="true" />
          <CardTitle>{detailMessages.slot.pickupCapacityTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
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
          <Wrench className="size-4" aria-hidden="true" />
          <CardTitle>{detailMessages.slot.resourceAssignmentsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
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
          <CalendarDays className="size-4" aria-hidden="true" />
          <CardTitle>{detailMessages.slot.relatedCloseoutsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
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

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> <span>{children}</span>
    </div>
  )
}

function DetailEmptyState({
  message,
  backLabel,
  onBack,
}: {
  message: string
  backLabel: string
  onBack?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <p className="text-muted-foreground">{message}</p>
      {onBack ? (
        <Button variant="outline" onClick={onBack}>
          {backLabel}
        </Button>
      ) : null}
    </div>
  )
}
