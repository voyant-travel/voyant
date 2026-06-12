// agent-quality: file-size exception -- owner: availability-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import {
  Activity,
  BookOpen,
  CalendarDays,
  History,
  Info,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Truck,
  UserMinus,
  UserPlus,
  Wrench,
} from "lucide-react"
import { type ComponentType, type ReactNode, useState } from "react"
import { useAvailabilityUiI18nOrDefault } from "../i18n/index.js"
import {
  type AllocationAuditLogEntry,
  type AllocationManifestBooking,
  type AvailabilitySlotAssignmentRow,
  type AvailabilitySlotDetail,
  type AvailabilitySlotRow,
  getPickupPointsQueryOptions,
  getProductQueryOptions,
  getSlotAllocationQueryOptions,
  getSlotAssignmentsQueryOptions,
  getSlotCloseoutsQueryOptions,
  getSlotPickupsQueryOptions,
  getSlotQueryOptions,
  getSlotResourcesQueryOptions,
  slotLocalEnd,
  slotLocalStart,
  slotStatusTone,
  useAvailabilitySlotMutation,
  useSlotAllocationAuditLog,
  useVoyantAvailabilityContext,
  type VoyantAvailabilityContextValue,
} from "../index.js"
import { getSlotStatusLabel } from "./availability-columns.js"
import { AvailabilitySlotDetailSkeleton } from "./availability-skeletons.js"
import { slotStatusToneClass } from "./slot-status-tone.js"

export interface AvailabilitySlotDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onOpenProduct?: (productId: string) => void
  onOpenStartTime?: (startTimeId: string) => void
  onCreateBooking?: (input: { slotId: string; productId: string }) => void
  /**
   * Opens the host's slot-edit dialog (status / pax / dates / notes …).
   * The detail page only surfaces the button — the host owns the dialog
   * because it already has the catalog data (products / rules / start
   * times) the edit form needs.
   */
  onEdit?: () => void
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
  /**
   * Content for the Extras tab. Hosts that mount `@voyantjs/extras` can
   * render a slot-level operations manifest here without making
   * availability-ui depend on extras-ui.
   */
  renderExtras?: (context: { slotId: string; productId: string | null }) => ReactNode
  extrasTabLabel?: ReactNode
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

export function getAvailabilitySlotAllocationQueryOptions(
  client: VoyantAvailabilityContextValue,
  id: string | null | undefined,
) {
  return getSlotAllocationQueryOptions(client, id)
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
    queryClient.ensureQueryData(getAvailabilitySlotAllocationQueryOptions(client, id)),
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
  onCreateBooking,
  onEdit,
  breadcrumb,
  headerActions,
  renderAllocation,
  renderExtras,
  extrasTabLabel,
}: AvailabilitySlotDetailPageProps) {
  const client = useVoyantAvailabilityContext()
  const i18n = useAvailabilityUiI18nOrDefault()
  const messages = i18n.messages
  const detailMessages = messages.details
  const noValue = detailMessages.noValue
  const slotMutation = useAvailabilitySlotMutation()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
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
  const allocationQuery = useQuery(getAvailabilitySlotAllocationQueryOptions(client, id))
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
  const allocationBookings = allocationQuery.data?.data.bookings ?? []
  const bookingById = new Map(allocationBookings.map((item) => [item.id, item]))
  const travelerById = new Map<
    string,
    { fullName: string; bookingNumber: string; bookingId: string }
  >()
  for (const booking of allocationBookings) {
    for (const traveler of booking.travelers) {
      travelerById.set(traveler.id, {
        fullName: traveler.fullName,
        bookingNumber: traveler.bookingNumber,
        bookingId: traveler.bookingId,
      })
    }
  }
  const productSellCurrency = productQuery.data?.data.sellCurrency ?? null
  const financialRollup = aggregateSlotFinancials(allocationBookings, productSellCurrency)

  const productName = productQuery.data?.data.name ?? null
  const productTypeName = productQuery.data?.data.productType?.name ?? null
  const dateRangeLabel = formatSlotDateRange(slot)
  const nightsLabel = computeSlotNightsLabel(slot, detailMessages.duration)
  const titleText = productName ?? dateRangeLabel
  const flagBadges = [
    slot.unlimited ? detailMessages.slot.unlimitedLabel : null,
    slot.pastCutoff ? detailMessages.slot.pastCutoffLabel : null,
    slot.tooEarly ? detailMessages.slot.tooEarlyLabel : null,
  ].filter((value): value is string => Boolean(value))

  const pickupRows = slotPickupsQuery.data?.data ?? []
  const assignmentRows = assignmentsQuery.data?.data ?? []
  const closeoutRows = closeoutsQuery.data?.data ?? []
  const auditEntries = auditLogQuery.data?.data ?? []

  const handleDelete = async () => {
    await slotMutation.remove.mutateAsync(slot.id)
    setDeleteDialogOpen(false)
    onDeleted?.()
  }

  const fallbackActions = headerActions ?? (
    <div className="flex flex-wrap items-center gap-2">
      {slot.productId && onCreateBooking ? (
        <Button
          variant="outline"
          onClick={() => onCreateBooking({ slotId: id, productId: slot.productId })}
        >
          <BookOpen data-icon="inline-start" aria-hidden="true" />
          {detailMessages.createBooking}
        </Button>
      ) : null}
      {onEdit ? (
        <Button variant="outline" onClick={onEdit}>
          <Pencil data-icon="inline-start" aria-hidden="true" />
          {detailMessages.editSlot}
        </Button>
      ) : null}
      {slot.productId && onOpenProduct ? (
        <Button variant="outline" onClick={() => onOpenProduct(slot.productId)}>
          <Package data-icon="inline-start" aria-hidden="true" />
          {detailMessages.openProduct}
        </Button>
      ) : null}
      <Button
        variant="destructive"
        onClick={() => setDeleteDialogOpen(true)}
        disabled={slotMutation.remove.isPending}
      >
        {detailMessages.delete}
      </Button>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{detailMessages.slot.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{detailMessages.slot.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{detailMessages.slot.deleteCancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={slotMutation.remove.isPending}
            >
              {detailMessages.slot.deleteConfirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      {breadcrumb ? <div className="text-sm">{breadcrumb}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{titleText}</h1>
            <Badge variant="outline" className={slotStatusToneClass[slotStatusTone[slot.status]]}>
              {getSlotStatusLabel(slot.status, messages)}
            </Badge>
            {productTypeName ? <Badge variant="outline">{productTypeName}</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {dateRangeLabel}
              {nightsLabel ? ` · ${nightsLabel}` : null}
            </span>
            <Badge variant="outline">{slot.timezone}</Badge>
          </div>
          {flagBadges.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {flagBadges.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {fallbackActions}
      </div>

      <KpiStrip
        slot={slot}
        rollup={financialRollup}
        formatCurrency={i18n.formatCurrency}
        i18nLabels={{
          pax: detailMessages.slot.paxKpiLabel,
          total: detailMessages.slot.totalKpiLabel,
          paid: detailMessages.slot.paidKpiLabel,
          outstanding: detailMessages.slot.outstandingKpiLabel,
          mixedHint: detailMessages.slot.mixedCurrenciesHint,
          noValue,
        }}
      />

      <Tabs defaultValue="allocation">
        <TabsList className="flex h-auto w-fit flex-wrap justify-start">
          <TabsTrigger value="allocation">{detailMessages.tabs.allocation}</TabsTrigger>
          {renderExtras ? (
            <TabsTrigger value="extras">{extrasTabLabel ?? detailMessages.tabs.extras}</TabsTrigger>
          ) : null}
          {pickupRows.length > 0 ? (
            <TabsTrigger value="pickup">
              {detailMessages.tabs.pickup}
              <Badge variant="outline" className="ml-1.5">
                {pickupRows.length}
              </Badge>
            </TabsTrigger>
          ) : null}
          {closeoutRows.length > 0 ? (
            <TabsTrigger value="closeouts">
              {detailMessages.tabs.closeouts}
              <Badge variant="outline" className="ml-1.5">
                {closeoutRows.length}
              </Badge>
            </TabsTrigger>
          ) : null}
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

        {renderExtras ? (
          <TabsContent value="extras" className="mt-4">
            {renderExtras({ slotId: id, productId: slot.productId })}
          </TabsContent>
        ) : null}

        {pickupRows.length > 0 ? (
          <TabsContent value="pickup" className="mt-4">
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
          </TabsContent>
        ) : null}

        {closeoutRows.length > 0 ? (
          <TabsContent value="closeouts" className="mt-4">
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
          </TabsContent>
        ) : null}

        <TabsContent value="activity" className="mt-4 flex flex-col gap-4">
          {slot.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {detailMessages.notesTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">{slot.notes}</CardContent>
            </Card>
          ) : null}
          <ActivityTimeline
            assignments={assignmentRows}
            auditEntries={auditEntries}
            resourceById={resourceById}
            bookingById={bookingById}
            travelerById={travelerById}
            formatDateTime={i18n.formatDateTime}
            i18n={{
              title: detailMessages.tabs.activity,
              empty: detailMessages.tabs.activityEmpty,
              filterAll: detailMessages.tabs.activityFilterAll,
              filterAudit: detailMessages.tabs.activityFilterAudit,
              filterAssignments: detailMessages.tabs.activityFilterAssignments,
              byActor: detailMessages.tabs.activityByActor,
              unassignedResource: detailMessages.slot.unassignedResource,
              bookingLabel: detailMessages.slot.bookingLabel,
              auditActionLabels: detailMessages.tabs.auditActionLabels,
              ongoing: detailMessages.tabs.activityOngoing,
              noValue,
            }}
          />
        </TabsContent>

        <TabsContent value="meta" className="mt-4">
          <MetaTab
            slot={slot}
            productName={productName}
            statusLabel={getSlotStatusLabel(slot.status, messages)}
            onOpenProduct={onOpenProduct}
            onOpenStartTime={onOpenStartTime}
            i18n={{
              title: detailMessages.tabs.metaTitle,
              slotIdLabel: detailMessages.tabs.metaSlotId,
              ruleLabel: detailMessages.slot.ruleLabel,
              startTimeLabel: detailMessages.slot.startTimeIdLabel,
              endsAtLabel: detailMessages.slot.endsAtLabel,
              createdLabel: detailMessages.createdLabel,
              updatedLabel: detailMessages.updatedLabel,
              productLabel: messages.productLabel,
              statusLabel: messages.statusLabel,
              timezoneLabel: messages.timezoneLabel,
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
  rollup,
  formatCurrency,
  i18nLabels,
}: {
  slot: AvailabilitySlotRow
  rollup: SlotFinancialRollup
  formatCurrency: (value: number, currency: string) => string
  i18nLabels: {
    pax: string
    total: string
    paid: string
    outstanding: string
    mixedHint: string
    noValue: string
  }
}) {
  const paxValue = slot.unlimited ? "∞" : `${slot.remainingPax ?? 0} / ${slot.initialPax ?? 0}`
  const renderAmount = (pick: (totals: CurrencyTotals) => number): ReactNode => {
    if (rollup.entries.length === 0 || !rollup.primaryCurrency) {
      return i18nLabels.noValue
    }
    const primary = rollup.entries.find((entry) => entry.currency === rollup.primaryCurrency)
    return primary
      ? formatCurrency(pick(primary) / 100, primary.currency)
      : formatCurrency(0, rollup.primaryCurrency)
  }
  const renderHint = (pick: (totals: CurrencyTotals) => number): string | undefined => {
    if (rollup.entries.length <= 1) return undefined
    const others = rollup.entries.filter((entry) => entry.currency !== rollup.primaryCurrency)
    if (others.length === 0) return i18nLabels.mixedHint
    return `+ ${others.map((entry) => formatCurrency(pick(entry) / 100, entry.currency)).join(" · ")}`
  }
  const primary = rollup.primaryCurrency
    ? rollup.entries.find((entry) => entry.currency === rollup.primaryCurrency)
    : null
  const paidPercent =
    primary && primary.sellCents > 0
      ? Math.round((primary.paidCents / primary.sellCents) * 100)
      : null
  const outstandingPercent = paidPercent != null ? Math.max(0, 100 - paidPercent) : null

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label={i18nLabels.pax}>{paxValue}</StatCard>
      <StatCard label={i18nLabels.total} hint={renderHint((t) => t.sellCents)}>
        {renderAmount((t) => t.sellCents)}
      </StatCard>
      <StatCard
        label={i18nLabels.paid}
        hint={renderHint((t) => t.paidCents)}
        badge={paidPercent != null ? renderPercentBadge(paidPercent, paidBadgeClass) : null}
      >
        {renderAmount((t) => t.paidCents)}
      </StatCard>
      <StatCard
        label={i18nLabels.outstanding}
        hint={renderHint((t) => t.outstandingCents)}
        badge={
          outstandingPercent != null
            ? renderPercentBadge(outstandingPercent, outstandingBadgeClass)
            : null
        }
      >
        {renderAmount((t) => t.outstandingCents)}
      </StatCard>
    </div>
  )
}

function StatCard({
  label,
  children,
  hint,
  badge,
}: {
  label: string
  children: ReactNode
  hint?: string
  badge?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xl font-semibold tabular-nums leading-none">{children}</div>
          {badge}
        </div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}

function renderPercentBadge(percent: number, classFor: (percent: number) => string): ReactNode {
  return (
    <Badge variant="outline" className={cn("border-transparent", classFor(percent))}>
      {percent}%
    </Badge>
  )
}

function paidBadgeClass(percent: number): string {
  if (percent <= 0) return "bg-red-500/10 text-red-600 dark:text-red-400"
  if (percent >= 100) return "bg-green-500/10 text-green-600 dark:text-green-400"
  return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
}

function outstandingBadgeClass(percent: number): string {
  if (percent <= 0) return "bg-green-500/10 text-green-600 dark:text-green-400"
  if (percent >= 100) return "bg-red-500/10 text-red-600 dark:text-red-400"
  return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
}

interface CurrencyTotals {
  currency: string
  sellCents: number
  paidCents: number
  outstandingCents: number
}

export interface SlotFinancialRollup {
  primaryCurrency: string | null
  entries: CurrencyTotals[]
}

const FINANCIAL_BOOKING_STATUSES = new Set([
  "on_hold",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
])

export function aggregateSlotFinancials(
  bookings: ReadonlyArray<AllocationManifestBooking>,
  productCurrency: string | null,
): SlotFinancialRollup {
  const byCurrency = new Map<string, CurrencyTotals>()
  for (const booking of bookings) {
    if (!FINANCIAL_BOOKING_STATUSES.has(booking.status)) continue
    const currency = booking.sellCurrency
    if (!currency) continue
    const sell = booking.sellAmountCents ?? 0
    const paid = booking.paidAmountCents ?? 0
    if (sell <= 0 && paid <= 0) continue
    const entry = byCurrency.get(currency) ?? {
      currency,
      sellCents: 0,
      paidCents: 0,
      outstandingCents: 0,
    }
    entry.sellCents += sell
    entry.paidCents += paid
    byCurrency.set(currency, entry)
  }
  for (const entry of byCurrency.values()) {
    entry.outstandingCents = Math.max(0, entry.sellCents - entry.paidCents)
  }
  const entries = [...byCurrency.values()].sort((left, right) => right.sellCents - left.sellCents)
  const primaryCurrency =
    (productCurrency && byCurrency.has(productCurrency) ? productCurrency : null) ??
    entries[0]?.currency ??
    productCurrency ??
    null
  return { primaryCurrency, entries }
}

function MetaTab({
  slot,
  productName,
  statusLabel,
  onOpenProduct,
  onOpenStartTime,
  i18n: msg,
}: {
  slot: AvailabilitySlotDetail
  productName: string | null
  statusLabel: string
  onOpenProduct?: (productId: string) => void
  onOpenStartTime?: (startTimeId: string) => void
  i18n: {
    title: string
    slotIdLabel: string
    ruleLabel: string
    startTimeLabel: string
    endsAtLabel: string
    createdLabel: string
    updatedLabel: string
    productLabel: string
    statusLabel: string
    timezoneLabel: string
    noValue: string
    format: (value: string | Date) => string
  }
}) {
  const rows: Array<{ label: string; value: ReactNode }> = [
    {
      label: msg.slotIdLabel,
      value: <span className="font-mono text-xs">{slot.id}</span>,
    },
    {
      label: msg.productLabel,
      value:
        slot.productId && onOpenProduct ? (
          <Button
            variant="link"
            className="h-auto p-0 text-right"
            onClick={() => onOpenProduct(slot.productId)}
          >
            {productName ?? slot.productId}
          </Button>
        ) : (
          (productName ??
          slot.productId ?? <span className="text-muted-foreground">{msg.noValue}</span>)
        ),
    },
    {
      label: msg.statusLabel,
      value: (
        <Badge variant="outline" className={slotStatusToneClass[slotStatusTone[slot.status]]}>
          {statusLabel}
        </Badge>
      ),
    },
    {
      label: msg.timezoneLabel,
      value: <Badge variant="outline">{slot.timezone}</Badge>,
    },
    {
      label: msg.endsAtLabel,
      value: slot.endsAt ? (
        formatSlotLocalDateTime(slotLocalEnd(slot) ?? slotLocalStart(slot))
      ) : (
        <span className="text-muted-foreground">{msg.noValue}</span>
      ),
    },
  ]
  if (slot.availabilityRuleId) {
    rows.push({
      label: msg.ruleLabel,
      value: <span className="font-mono text-xs">{slot.availabilityRuleId}</span>,
    })
  }
  if (slot.startTimeId) {
    rows.push({
      label: msg.startTimeLabel,
      value: onOpenStartTime ? (
        <Button
          variant="link"
          className="h-auto p-0 text-right font-mono text-xs"
          onClick={() => onOpenStartTime(slot.startTimeId ?? "")}
        >
          {slot.startTimeId}
        </Button>
      ) : (
        <span className="font-mono text-xs">{slot.startTimeId}</span>
      ),
    })
  }
  rows.push({ label: msg.createdLabel, value: msg.format(slot.createdAt) })
  rows.push({ label: msg.updatedLabel, value: msg.format(slot.updatedAt) })

  return (
    <div data-slot="slot-metadata" className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {msg.title}
      </h2>
      <div className="overflow-hidden rounded-md border bg-background">
        <dl className="divide-y">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function formatSlotDateRange(slot: {
  dateLocal: string
  startsAt: string
  endsAt: string | null
  timezone: string
}): string {
  const start = formatSlotLocalDateTime(slotLocalStart(slot))
  if (!slot.endsAt) return start
  return `${start} → ${formatSlotLocalDateTime(slotLocalEnd(slot) ?? slotLocalStart(slot))}`
}

function formatSlotLocalDateTime(value: { date: string; time: string }) {
  return `${value.date} ${value.time}`
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

type ActivityTimelineSource = "assignment" | "audit"

interface ActivityTimelineEvent {
  id: string
  source: ActivityTimelineSource
  title: string
  description?: ReactNode
  timestamp: string
  /**
   * Active assignments expose no released timestamp — surface them as
   * "ongoing" in the meta line and sort them above released history so
   * unreleased rows aren't pinned to the bottom by a sentinel epoch.
   */
  isOngoing?: boolean
  actorId?: string | null
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  badge?: string
}

const AUDIT_ACTION_ICONS: Record<
  string,
  ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  "resource.create": Plus,
  "resource.update": Pencil,
  "resource.delete": Trash2,
  "traveler.assign": UserPlus,
  "traveler.unassign": UserMinus,
  "resources.materialize": Sparkles,
  "auto-allocate": Sparkles,
}

function humanizeAction(action: string, labels: Record<string, string>): string {
  return labels[action] ?? action.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function ActivityTimeline({
  assignments,
  auditEntries,
  resourceById,
  bookingById,
  travelerById,
  formatDateTime: formatDateTimeFn,
  i18n,
}: {
  assignments: AvailabilitySlotAssignmentRow[]
  auditEntries: AllocationAuditLogEntry[]
  resourceById: Map<string, { id: string; name: string }>
  bookingById: Map<string, AllocationManifestBooking>
  travelerById: Map<string, { fullName: string; bookingNumber: string; bookingId: string }>
  formatDateTime: (value: string | Date) => string
  i18n: {
    title: string
    empty: string
    filterAll: string
    filterAudit: string
    filterAssignments: string
    byActor: string
    unassignedResource: string
    bookingLabel: string
    auditActionLabels: Record<string, string>
    ongoing: string
    noValue: string
  }
}) {
  const [filter, setFilter] = useState<ActivityTimelineSource | "all">("all")
  const resourceLabel = (id: string | null | undefined) =>
    (id ? resourceById.get(id)?.name : null) ?? id ?? i18n.unassignedResource

  const events: ActivityTimelineEvent[] = []
  const nowIso = new Date().toISOString()
  for (const assignment of assignments) {
    const resource = resourceLabel(assignment.resourceId)
    const booking = bookingById.get(assignment.bookingId ?? "")
    // Active assignments don't carry a released timestamp. Sort them
    // alongside current activity using `now`, and flag the entry so
    // the row meta line renders "ongoing" instead of formatting the
    // sentinel time.
    const isOngoing = assignment.releasedAt == null
    events.push({
      id: `assignment:${assignment.id}`,
      source: "assignment",
      icon: Wrench,
      title: resource,
      badge: assignment.status,
      description: (
        <span>
          {i18n.bookingLabel}: {booking?.bookingNumber ?? assignment.bookingId ?? i18n.noValue}
          {assignment.notes ? ` · ${assignment.notes}` : null}
        </span>
      ),
      timestamp: assignment.releasedAt ?? nowIso,
      isOngoing,
      actorId: assignment.assignedBy,
    })
  }
  for (const entry of auditEntries) {
    const resource = entry.resourceId ? resourceLabel(entry.resourceId) : null
    const traveler = entry.travelerId ? travelerById.get(entry.travelerId) : null
    const detailParts: string[] = []
    if (traveler) detailParts.push(traveler.fullName)
    if (resource) detailParts.push(resource)
    events.push({
      id: `audit:${entry.id}`,
      source: "audit",
      icon: AUDIT_ACTION_ICONS[entry.action] ?? History,
      title: humanizeAction(entry.action, i18n.auditActionLabels),
      description: detailParts.length > 0 ? detailParts.join(" → ") : null,
      timestamp: entry.createdAt,
      actorId: entry.actorId,
    })
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const visible = filter === "all" ? events : events.filter((e) => e.source === filter)
  const hasAssignments = assignments.length > 0
  const hasAudit = auditEntries.length > 0
  const filters: Array<{ id: ActivityTimelineSource | "all"; label: string; show: boolean }> = [
    { id: "all", label: i18n.filterAll, show: true },
    { id: "assignment", label: i18n.filterAssignments, show: hasAssignments },
    { id: "audit", label: i18n.filterAudit, show: hasAudit },
  ]

  return (
    <div data-slot="slot-activity-timeline" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {i18n.title}
        </h2>
        {events.length > 0 && hasAssignments && hasAudit ? (
          <div className="flex flex-wrap items-center gap-1">
            {filters
              .filter((f) => f.show)
              .map((f) => (
                <Button
                  key={f.id}
                  variant={filter === f.id ? "default" : "ghost"}
                  size="sm"
                  className="h-7 capitalize"
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">{i18n.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((event) => (
            <ActivityTimelineItem
              key={event.id}
              event={event}
              formatDateTime={formatDateTimeFn}
              byActor={i18n.byActor}
              ongoingLabel={i18n.ongoing}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityTimelineItem({
  event,
  formatDateTime: formatDateTimeFn,
  byActor,
  ongoingLabel,
}: {
  event: ActivityTimelineEvent
  formatDateTime: (value: string | Date) => string
  byActor: string
  ongoingLabel: string
}) {
  const Icon = event.icon
  const timestamp = event.isOngoing ? ongoingLabel : formatDateTimeFn(event.timestamp)
  const actor = event.actorId && event.actorId !== "system" ? event.actorId : null
  const meta = actor
    ? byActor.replace("{actor}", actor).replace("{timestamp}", timestamp)
    : timestamp

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden={true} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium capitalize">{event.title}</p>
          {event.badge ? (
            <Badge variant="outline" className="text-xs capitalize">
              {event.badge}
            </Badge>
          ) : null}
        </div>
        {event.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  )
}
