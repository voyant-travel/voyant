"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import {
  type AvailabilitySlotDetail,
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
  useSlotAllocationAuditLog,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@voyantjs/ui/components"
import { CalendarDays, History, Package, Truck, Wrench } from "lucide-react"
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
  /**
   * Breadcrumb element rendered above the page header. Hosts that
   * already render breadcrumbs in their sidebar inset top bar can
   * leave this undefined.
   */
  breadcrumb?: ReactNode
  /**
   * Primary header actions (Open product, Delete, …). When supplied,
   * the in-page action buttons are hidden so the host can render the
   * same actions in the inset top bar instead.
   */
  headerActions?: ReactNode
  /**
   * Content for the Allocation tab. Hosts mount their allocation
   * manager here (e.g. `@voyantjs/allocation-ui`'s
   * `SlotAllocationPage` in `embed` mode) so this package keeps no
   * runtime dependency on the allocation UI. When omitted, the tab
   * shows a stub message instead.
   */
  renderAllocation?: (context: { slotId: string; productId: string | null }) => ReactNode
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
  onBack: _onBack,
  onDeleted,
  onOpenProduct,
  onOpenStartTime,
  confirmAction = (message) => globalThis.confirm?.(message) ?? true,
  breadcrumb,
  headerActions,
  renderAllocation,
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
  const auditLogQuery = useSlotAllocationAuditLog({ slotId: id })

  if (isPending) {
    return <AvailabilitySlotDetailSkeleton />
  }

  if (!slot) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.slot.notFound}</p>
      </div>
    )
  }

  const pickupPointById = new Map(
    (pickupPointsQuery.data?.data ?? []).map((item) => [item.id, item]),
  )
  const resourceById = new Map((resourcesQuery.data?.data ?? []).map((item) => [item.id, item]))
  const bookingById = new Map((bookingsQuery.data?.data ?? []).map((item) => [item.id, item]))

  const productName = productQuery.data?.data.name ?? null
  const dateRangeLabel = formatSlotDateRange(slot, i18n.formatDateTime)
  const nightsLabel = computeSlotNightsLabel(slot, detailMessages.duration)
  const titleText = productName ?? dateRangeLabel

  const pickupRows = slotPickupsQuery.data?.data ?? []
  const assignmentRows = assignmentsQuery.data?.data ?? []
  const closeoutRows = closeoutsQuery.data?.data ?? []
  const auditEntries = auditLogQuery.data?.data ?? []

  async function deleteSlot(currentSlot: AvailabilitySlotRow) {
    if (!confirmAction(detailMessages.slot.deleteConfirm)) return
    await slotMutation.remove.mutateAsync(currentSlot.id)
    onDeleted?.()
  }

  const fallbackActions = headerActions ?? (
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
        {detailMessages.delete}
      </Button>
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      {breadcrumb ? <div className="text-sm">{breadcrumb}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{titleText}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateRangeLabel}
            {nightsLabel ? ` · ${nightsLabel}` : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={slotStatusVariant[slot.status]}>
              {getSlotStatusLabel(slot.status, messages)}
            </Badge>
            <Badge variant="outline">{slot.timezone}</Badge>
            {slot.unlimited ? (
              <Badge variant="outline">{detailMessages.slot.unlimitedLabel}</Badge>
            ) : null}
            {slot.pastCutoff ? (
              <Badge variant="secondary">{detailMessages.slot.pastCutoffLabel}</Badge>
            ) : null}
            {slot.tooEarly ? (
              <Badge variant="secondary">{detailMessages.slot.tooEarlyLabel}</Badge>
            ) : null}
          </div>
        </div>
        {fallbackActions}
      </div>

      <KpiStrip
        slot={slot}
        productName={productName}
        productId={slot.productId}
        onOpenProduct={onOpenProduct}
        i18nLabels={{
          pax: detailMessages.slot.initialPaxLabel,
          remainingPax: messages.remainingPaxLabel,
          product: messages.productLabel,
          date: messages.dateLabel,
          notes: detailMessages.notesTitle,
        }}
      />

      <Tabs defaultValue="allocation">
        <TabsList className="flex h-auto w-fit flex-wrap justify-start">
          <TabsTrigger value="allocation">{detailMessages.tabs.allocation}</TabsTrigger>
          <TabsTrigger value="pickup">
            {detailMessages.tabs.pickup}
            {pickupRows.length > 0 ? (
              <Badge variant="outline" className="ml-1.5">
                {pickupRows.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="closeouts">
            {detailMessages.tabs.closeouts}
            {closeoutRows.length > 0 ? (
              <Badge variant="outline" className="ml-1.5">
                {closeoutRows.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="activity">
            {detailMessages.tabs.activity}
            {auditEntries.length > 0 ? (
              <Badge variant="outline" className="ml-1.5">
                {auditEntries.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="meta">{detailMessages.tabs.meta}</TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="mt-4">
          {renderAllocation ? (
            renderAllocation({ slotId: id, productId: slot.productId })
          ) : (
            <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {detailMessages.tabs.allocationUnwired}
            </p>
          )}
        </TabsContent>

        <TabsContent value="pickup" className="mt-4">
          {pickupRows.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {detailMessages.slot.pickupCapacityEmpty}
            </p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {pickupRows.map((pickup) => {
                const point = pickupPointById.get(pickup.pickupPointId)
                return (
                  <div key={pickup.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-2 font-medium">
                      <Truck className="size-4" aria-hidden="true" />
                      {point?.name ?? pickup.pickupPointId}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {point?.locationText ?? detailMessages.slot.noLocationText}
                    </div>
                    <div className="mt-2">
                      {detailMessages.slot.initialLabel}: {pickup.initialCapacity ?? noValue} ·{" "}
                      {detailMessages.slot.remainingLabel}: {pickup.remainingCapacity ?? noValue}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closeouts" className="mt-4">
          {closeoutRows.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {detailMessages.slot.relatedCloseoutsEmpty}
            </p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {closeoutRows.map((closeout) => (
                <div key={closeout.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2 font-medium">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {closeout.dateLocal}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {detailMessages.slot.createdByLabel}: {closeout.createdBy ?? noValue}
                  </div>
                  {closeout.reason ? (
                    <div className="mt-2 whitespace-pre-wrap">{closeout.reason}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {auditEntries.length === 0 && assignmentRows.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {detailMessages.tabs.activityEmpty}
            </p>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              {assignmentRows.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <Wrench className="mr-1 inline-block size-4" aria-hidden="true" />
                    {detailMessages.slot.resourceAssignmentsTitle}
                  </h3>
                  {assignmentRows.map((assignment) => (
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
                  ))}
                </div>
              ) : null}
              {auditEntries.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="mr-1 inline-block size-4" aria-hidden="true" />
                    {detailMessages.tabs.activityAuditTitle}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {auditEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-baseline gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {i18n.formatDateTime(entry.createdAt)}
                        </span>
                        <span className="font-medium">{entry.action}</span>
                        <span className="text-muted-foreground">
                          {entry.actorId ?? detailMessages.slot.createdByLabel}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="meta" className="mt-4">
          <MetaTab
            slot={slot}
            productName={productName}
            onOpenProduct={onOpenProduct}
            onOpenStartTime={onOpenStartTime}
            i18n={{
              identifiersTitle: detailMessages.tabs.metaIdentifiersTitle,
              lifecycleTitle: detailMessages.tabs.metaLifecycleTitle,
              notesTitle: detailMessages.notesTitle,
              ruleLabel: detailMessages.slot.ruleLabel,
              startTimeLabel: detailMessages.slot.startTimeIdLabel,
              endsAtLabel: detailMessages.slot.endsAtLabel,
              createdLabel: detailMessages.createdLabel,
              updatedLabel: detailMessages.updatedLabel,
              productLabel: messages.productLabel,
              noValue,
              format: i18n.formatDateTime,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KpiStrip({
  slot,
  productName,
  productId,
  onOpenProduct,
  i18nLabels,
}: {
  slot: AvailabilitySlotRow
  productName: string | null
  productId: string | null
  onOpenProduct?: (productId: string) => void
  i18nLabels: {
    pax: string
    remainingPax: string
    product: string
    date: string
    notes: string
  }
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCell
        label={`${i18nLabels.remainingPax} / ${i18nLabels.pax}`}
        value={slot.unlimited ? "∞" : `${slot.remainingPax ?? 0} / ${slot.initialPax ?? 0}`}
      />
      <KpiCell
        label={i18nLabels.product}
        value={
          productId && onOpenProduct ? (
            <Button variant="link" className="h-auto p-0" onClick={() => onOpenProduct(productId)}>
              {productName ?? productId}
            </Button>
          ) : (
            (productName ?? productId ?? "—")
          )
        }
      />
      <KpiCell label={i18nLabels.date} value={slot.dateLocal} />
      <KpiCell label={i18nLabels.notes} value={slot.notes ?? "—"} muted={!slot.notes} />
    </div>
  )
}

function KpiCell({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn("truncate text-base font-medium", muted ? "text-muted-foreground" : null)}
      >
        {value}
      </CardContent>
    </Card>
  )
}

function MetaTab({
  slot,
  productName,
  onOpenProduct,
  onOpenStartTime,
  i18n: msg,
}: {
  slot: AvailabilitySlotDetail
  productName: string | null
  onOpenProduct?: (productId: string) => void
  onOpenStartTime?: (startTimeId: string) => void
  i18n: {
    identifiersTitle: string
    lifecycleTitle: string
    notesTitle: string
    ruleLabel: string
    startTimeLabel: string
    endsAtLabel: string
    createdLabel: string
    updatedLabel: string
    productLabel: string
    noValue: string
    format: (value: string | Date) => string
  }
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{msg.identifiersTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <DetailLine label={msg.productLabel}>
            {slot.productId && onOpenProduct ? (
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => onOpenProduct(slot.productId)}
              >
                {productName ?? slot.productId}
              </Button>
            ) : (
              (productName ?? slot.productId ?? msg.noValue)
            )}
          </DetailLine>
          {slot.availabilityRuleId ? (
            <DetailLine label={msg.ruleLabel}>{slot.availabilityRuleId}</DetailLine>
          ) : null}
          {slot.startTimeId ? (
            <DetailLine label={msg.startTimeLabel}>
              {onOpenStartTime ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => onOpenStartTime(slot.startTimeId ?? "")}
                >
                  {slot.startTimeId}
                </Button>
              ) : (
                slot.startTimeId
              )}
            </DetailLine>
          ) : null}
          <DetailLine label={msg.endsAtLabel}>
            {slot.endsAt ? formatDateTime(slot.endsAt) : msg.noValue}
          </DetailLine>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{msg.lifecycleTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <DetailLine label={msg.createdLabel}>{msg.format(slot.createdAt)}</DetailLine>
          <DetailLine label={msg.updatedLabel}>{msg.format(slot.updatedAt)}</DetailLine>
        </CardContent>
      </Card>

      {slot.notes ? (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{msg.notesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{slot.notes}</CardContent>
        </Card>
      ) : null}
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

function formatSlotDateRange(
  slot: { dateLocal: string; startsAt: string; endsAt: string | null },
  format: (value: string) => string,
): string {
  if (!slot.endsAt) return `${slot.dateLocal} · ${format(slot.startsAt)}`
  const startLocal = slot.dateLocal
  const endLocal = isoDateOf(slot.endsAt)
  if (!endLocal || startLocal === endLocal) {
    return `${slot.dateLocal} · ${format(slot.startsAt)}`
  }
  return `${startLocal} → ${endLocal}`
}

function computeSlotNightsLabel(
  slot: { nights: number | null; days: number | null },
  labels: {
    nightSingular: string
    nightsPlural: string
    daySingular: string
    daysPlural: string
  },
): string | null {
  if (slot.nights && slot.nights > 0) {
    return slot.nights === 1
      ? labels.nightSingular
      : labels.nightsPlural.replace("{count}", String(slot.nights))
  }
  if (slot.days && slot.days > 0) {
    return slot.days === 1
      ? labels.daySingular
      : labels.daysPlural.replace("{count}", String(slot.days))
  }
  return null
}

function isoDateOf(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.length >= 10 ? value.slice(0, 10) : null
  }
  return date.toISOString().slice(0, 10)
}
