// agent-quality: file-size exception -- owner: allocation-ui; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import { useQuery } from "@tanstack/react-query"
import {
  type AllocationManifestBooking,
  type AllocationManifestTraveler,
  getSlotQueryOptions,
  type SlotAllocationManifest,
  useAllocationAutomationMutation,
  useAllocationResourceMutation,
  useAssignTravelerAllocationMutation,
  useProductResourceTemplates,
  useSlotAllocation,
  useVoyantAvailabilityContext,
} from "@voyantjs/availability-react"
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@voyantjs/ui/components"
import {
  Accessibility,
  AlertTriangle,
  Armchair,
  ArrowLeft,
  Bed,
  BookOpen,
  Crown,
  Plus,
  Sparkles,
  Users,
  UtensilsCrossed,
  Wand2,
} from "lucide-react"
import { type FormEvent, type ReactNode, useMemo, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import {
  collectOccupants,
  defaultCapacityFor,
  deriveAllocationKinds,
  kindLabel,
  parentKindFor,
  type ResourceCapacitySummary,
  ROOM_KIND,
  summarizeResourceCapacity,
  VEHICLE_SEAT_KIND,
} from "./slot-allocation-model.js"
import { ResourceColumnsView } from "./slot-allocation-resource-view.js"
import { VehicleSeatsView } from "./slot-allocation-seat-view.js"
import { paymentStatusChipClass, paymentStatusTooltip } from "./slot-allocation-shared.js"

export interface SlotAllocationPageRenderContext {
  slotId: string
  tabId: string
  kind: string
  allocationKind: string
  manifest: SlotAllocationManifest
  travelers: AllocationManifestTraveler[]
  allocationKinds: string[]
}

export interface SlotAllocationPageExtraTab {
  id: string
  label: ReactNode
  icon?: ReactNode
  render: (context: SlotAllocationPageRenderContext) => ReactNode
}

export interface SlotAllocationPageProps {
  slotId: string
  className?: string
  onBack?: () => void
  /**
   * Fired when the operator clicks a booking number on an allocation
   * chip. The host owns the side-panel / drawer / route — this hook
   * just supplies the booking id. When omitted, booking numbers render
   * as plain text.
   */
  onBookingOpen?: (bookingId: string) => void
  renderExtraActions?: (context: { slotId: string; kind: string }) => ReactNode
  onCreateBooking?: (input: { slotId: string; productId: string }) => void
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
  renderHeaderEnd?: (context: SlotAllocationPageRenderContext) => ReactNode
  renderBefore?: (context: SlotAllocationPageRenderContext) => ReactNode
  renderAfter?: (context: SlotAllocationPageRenderContext) => ReactNode
  extraTabs?: SlotAllocationPageExtraTab[]
  /**
   * Drop the top-level page header (title + back arrow). The host is
   * expected to render its own. Capacity badges + the actions cluster
   * stay as an inline toolbar above the kind tabs so the body is
   * still self-sufficient when embedded.
   */
  embed?: boolean
}

export function SlotAllocationPage({
  slotId,
  className,
  onBack,
  onBookingOpen,
  renderExtraActions,
  onCreateBooking,
  renderTravelerActions,
  renderHeaderEnd,
  renderBefore,
  renderAfter,
  extraTabs = [],
  embed = false,
}: SlotAllocationPageProps) {
  const messages = useAllocationUiMessagesOrDefault()
  const availabilityClient = useVoyantAvailabilityContext()
  const allocation = useSlotAllocation({ slotId })
  const slotRowQuery = useQuery(getSlotQueryOptions(availabilityClient, slotId))
  const slotRow = slotRowQuery.data?.data
  const resourceMutation = useAllocationResourceMutation(slotId)
  const assignMutation = useAssignTravelerAllocationMutation(slotId)
  const automationMutation = useAllocationAutomationMutation(slotId)
  const [selectedKind, setSelectedKind] = useState(ROOM_KIND)
  const [addingResource, setAddingResource] = useState(false)
  const [resourceLabel, setResourceLabel] = useState("")
  const [resourceCapacity, setResourceCapacity] = useState(2)
  const [resourceOptionId, setResourceOptionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const data = allocation.data?.data
  const templates = useProductResourceTemplates({
    productId: data?.slot.productId,
    enabled: Boolean(data?.slot.productId),
  })

  const travelers = useMemo(() => {
    const out: AllocationManifestTraveler[] = []
    for (const booking of data?.bookings ?? []) {
      if (booking.status === "cancelled") continue
      out.push(...booking.travelers)
    }
    return out
  }, [data?.bookings])

  const allocationKinds = useMemo(() => {
    return deriveAllocationKinds({
      resources: data?.resources ?? [],
      templateOptions: templates.data?.data ?? [],
    })
  }, [data?.resources, templates.data?.data])

  // option_id → option name, used by ResourceColumnsView to badge each
  // resource row with the option it's tied to (Standard double, etc.).
  const optionNamesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const option of templates.data?.data ?? []) {
      map.set(option.id, option.name)
    }
    return map
  }, [templates.data?.data])

  const visibleExtraTabs = extraTabs.filter((tab) => !allocationKinds.includes(tab.id))
  const selectedAllocationKind = allocationKinds.includes(selectedKind) ? selectedKind : undefined
  const selectedExtraTab = selectedAllocationKind
    ? undefined
    : (visibleExtraTabs.find((tab) => tab.id === selectedKind) ??
      (allocationKinds.length === 0 ? visibleExtraTabs[0] : undefined))
  const activeAllocationKind = selectedExtraTab
    ? undefined
    : (selectedAllocationKind ?? allocationKinds[0])
  const activeKind = activeAllocationKind ?? ROOM_KIND
  const activeTabId = selectedExtraTab?.id ?? activeKind
  const hasAllocationView = Boolean(activeAllocationKind)
  const hasTabs = allocationKinds.length > 0 || visibleExtraTabs.length > 0
  const hasPassengerOnlyView = allocationKinds.length === 0 && visibleExtraTabs.length === 0
  const resources = useMemo(
    () => (data?.resources ?? []).filter((resource) => resource.kind === activeKind),
    [data?.resources, activeKind],
  )
  const parentResources = useMemo(
    () => (data?.resources ?? []).filter((resource) => resource.kind === parentKindFor(activeKind)),
    [data?.resources, activeKind],
  )
  const occupants = useMemo(
    () => collectOccupants(travelers, resources, activeKind),
    [travelers, resources, activeKind],
  )
  const capacitySummary = useMemo<ResourceCapacitySummary>(
    () =>
      summarizeResourceCapacity({
        resources,
        slotInitialPax: slotRow?.initialPax ?? null,
        slotRemainingPax: slotRow?.remainingPax ?? null,
        unlimited: slotRow?.unlimited ?? false,
      }),
    [resources, slotRow?.initialPax, slotRow?.remainingPax, slotRow?.unlimited],
  )
  const projectedSummary = useMemo<ResourceCapacitySummary | null>(() => {
    if (!addingResource) return null
    const capacityNumber = Number.isFinite(resourceCapacity) ? Math.max(0, resourceCapacity) : 0
    return summarizeResourceCapacity({
      resources: [
        ...resources,
        {
          id: "__projected__",
          slotId,
          kind: activeKind,
          label: null,
          refType: null,
          refId: null,
          capacity: capacityNumber,
          flags: {},
          parentId: null,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      slotInitialPax: slotRow?.initialPax ?? null,
      slotRemainingPax: slotRow?.remainingPax ?? null,
      unlimited: slotRow?.unlimited ?? false,
    })
  }, [
    addingResource,
    resourceCapacity,
    resources,
    slotId,
    activeKind,
    slotRow?.initialPax,
    slotRow?.remainingPax,
    slotRow?.unlimited,
  ])

  async function assignTraveler(travelerId: string, resourceId: string | null) {
    setError(null)
    try {
      await assignMutation.mutateAsync({ travelerId, kind: activeKind, resourceId })
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.allocationFailed)
    }
  }

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await resourceMutation.create.mutateAsync({
        kind: activeKind,
        label: resourceLabel.trim() || null,
        capacity: resourceCapacity,
        refType: resourceOptionId ? "option" : null,
        refId: resourceOptionId,
      })
      setResourceLabel("")
      setResourceCapacity(defaultCapacityFor(activeKind))
      setResourceOptionId(null)
      setAddingResource(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.createResourceFailed)
    }
  }

  async function editResource(
    resourceId: string,
    input: { label: string | null; capacity: number },
  ) {
    setError(null)
    try {
      await resourceMutation.update.mutateAsync({ resourceId, input })
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.updateResourceFailed)
      throw err
    }
  }

  async function generateResources() {
    setError(null)
    try {
      // Materialize the full configured inventory across all kinds (e.g. all 20
      // doubles + 20 singles + 6 triples) in one click, rather than the
      // pax-derived single-kind auto-materialize.
      await automationMutation.materializeTemplates.mutateAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.generateResourcesFailed)
    }
  }

  async function autoAllocate() {
    setError(null)
    try {
      await automationMutation.autoAllocate.mutateAsync({ kind: activeKind })
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.autoAllocateFailed)
    }
  }

  if (allocation.isPending) {
    return (
      <div className={cn("p-6 text-sm text-muted-foreground", className)}>{messages.loading}</div>
    )
  }

  // Only short-circuit when we genuinely have no data to render
  // against. The page intentionally renders even when both resources
  // and travelers are empty so operators can seed the per-departure
  // resource block before any bookings exist — setting up the room
  // block before selling is the canonical flow. The per-kind resource
  // view handles its own empty state (and the "Add resource" /
  // "Generate resources" affordances stay reachable).
  if (!data) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 p-8", className)}>
        <Users className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{messages.empty}</p>
      </div>
    )
  }

  const isSeatMap = activeKind === VEHICLE_SEAT_KIND
  const canManuallyAddResource = !isSeatMap
  const createBookingProductId = data.slot.productId
  const context: SlotAllocationPageRenderContext = {
    slotId,
    tabId: activeTabId,
    kind: activeTabId,
    allocationKind: activeKind,
    manifest: data,
    travelers,
    allocationKinds,
  }

  const summaryLine = (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {selectedExtraTab || !hasAllocationView ? null : (
        <CapacitySummaryBadges summary={capacitySummary} messages={messages} kind={activeKind} />
      )}
    </div>
  )

  const actionsCluster = (
    <div className="flex flex-wrap items-center gap-2">
      {selectedExtraTab || !hasAllocationView
        ? null
        : renderExtraActions?.({ slotId, kind: activeKind })}
      {onCreateBooking && createBookingProductId ? (
        <Button
          variant="outline"
          onClick={() => onCreateBooking({ slotId, productId: createBookingProductId })}
        >
          <BookOpen data-icon="inline-start" aria-hidden="true" />
          {messages.createBooking}
        </Button>
      ) : null}
      {selectedExtraTab || !hasAllocationView ? null : resources.length === 0 ? (
        <Button
          variant="outline"
          onClick={() => void generateResources()}
          disabled={automationMutation.materializeTemplates.isPending}
        >
          <Sparkles data-icon="inline-start" aria-hidden="true" />
          {automationMutation.materializeTemplates.isPending
            ? messages.generatingResources
            : messages.generateResources}
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={() => void autoAllocate()}
          disabled={automationMutation.autoAllocate.isPending}
        >
          <Wand2 data-icon="inline-start" aria-hidden="true" />
          {automationMutation.autoAllocate.isPending
            ? messages.autoAllocating
            : messages.autoAllocate}
        </Button>
      )}
      {!selectedExtraTab && hasAllocationView && canManuallyAddResource ? (
        <Button
          variant="outline"
          onClick={() => {
            setResourceLabel("")
            setResourceCapacity(defaultCapacityFor(activeKind))
            setResourceOptionId(null)
            setError(null)
            setAddingResource(true)
          }}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          {messages.addResource}
        </Button>
      ) : null}
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-4", embed ? null : "p-6", className)}>
      {embed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {summaryLine}
          {actionsCluster}
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            {onBack ? (
              <Button variant="ghost" size="icon" onClick={onBack} aria-label={messages.back}>
                <ArrowLeft data-icon aria-hidden="true" />
              </Button>
            ) : null}
            <div>
              <h1 className="text-2xl font-semibold">{messages.pageTitle}</h1>
              <div className="mt-1">{summaryLine}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            {renderHeaderEnd?.(context)}
            {actionsCluster}
          </div>
        </div>
      )}

      {renderBefore?.(context)}

      {hasTabs ? (
        <Tabs value={activeTabId} onValueChange={setSelectedKind}>
          <TabsList className="flex h-auto w-fit flex-wrap justify-start">
            {allocationKinds.map((kind) => (
              <TabsTrigger key={kind} value={kind} className="gap-2">
                {kind === VEHICLE_SEAT_KIND ? (
                  <Armchair className="size-4" aria-hidden="true" />
                ) : (
                  <Bed className="size-4" aria-hidden="true" />
                )}
                {kindLabel(kind, messages)}
              </TabsTrigger>
            ))}
            {visibleExtraTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      {selectedExtraTab ? (
        selectedExtraTab.render(context)
      ) : hasPassengerOnlyView ? (
        <PassengerListPanel
          bookings={data.bookings}
          sharingGroupLabels={data.sharingGroupLabels}
          onBookingOpen={onBookingOpen}
          renderTravelerActions={renderTravelerActions}
          messages={messages}
        />
      ) : !hasAllocationView ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-center">
          <Users className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{messages.noAllocationsToManage}</p>
        </div>
      ) : (
        <>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {canManuallyAddResource ? (
            <Dialog open={addingResource} onOpenChange={setAddingResource}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{messages.addResource}</DialogTitle>
                </DialogHeader>
                <form onSubmit={createResource}>
                  <DialogBody className="grid gap-4">
                    {(templates.data?.data ?? []).length > 0 ? (
                      <div className="grid gap-1.5">
                        <Label htmlFor="allocation-resource-option">
                          {messages.resourceOption}
                        </Label>
                        <Select
                          value={resourceOptionId ?? "__none__"}
                          onValueChange={(value) => {
                            const next = value === "__none__" ? null : value
                            setResourceOptionId(next)
                            // Default capacity from the option's matching template
                            // when one exists. Operators can still override.
                            if (next) {
                              const option = (templates.data?.data ?? []).find((o) => o.id === next)
                              const template = option?.templates.find((t) => t.kind === activeKind)
                              if (template?.capacity) setResourceCapacity(template.capacity)
                            }
                          }}
                        >
                          <SelectTrigger id="allocation-resource-option" className="w-full">
                            <SelectValue placeholder={messages.resourceOptionPlaceholder}>
                              {(value) =>
                                value === "__none__"
                                  ? messages.resourceOptionNone
                                  : ((templates.data?.data ?? []).find(
                                      (option) => option.id === value,
                                    )?.name ?? value)
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{messages.resourceOptionNone}</SelectItem>
                            {(templates.data?.data ?? []).map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="grid gap-1.5">
                      <Label htmlFor="allocation-resource-label">{messages.resourceLabel}</Label>
                      <Input
                        id="allocation-resource-label"
                        value={resourceLabel}
                        onChange={(event) => setResourceLabel(event.target.value)}
                        placeholder={
                          activeKind === ROOM_KIND ? "102" : kindLabel(activeKind, messages)
                        }
                        autoFocus
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="allocation-resource-capacity">
                        {messages.resourceCapacity}
                      </Label>
                      <Input
                        id="allocation-resource-capacity"
                        type="number"
                        min={1}
                        value={resourceCapacity}
                        onChange={(event) => setResourceCapacity(Number(event.target.value) || 1)}
                      />
                    </div>
                    {projectedSummary?.status === "over" && projectedSummary.delta != null ? (
                      <div
                        className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                        role="status"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {/* i18n-literal-ok numeric interpolation only */}
                        <span>
                          {messages.overCapacityWarning} {projectedSummary.resourceCapacity}/
                          {projectedSummary.slotPax ?? "—"} ({messages.resourceCapacityOver}:{" "}
                          {projectedSummary.delta})
                        </span>
                      </div>
                    ) : null}
                  </DialogBody>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setAddingResource(false)}>
                      {messages.cancel}
                    </Button>
                    <Button type="submit" disabled={resourceMutation.create.isPending}>
                      {messages.createResource}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}

          {isSeatMap ? (
            <VehicleSeatsView
              seats={resources}
              vehicles={parentResources}
              occupants={occupants}
              sharingGroupLabels={data.sharingGroupLabels}
              onAssignTraveler={(travelerId, resourceId) =>
                void assignTraveler(travelerId, resourceId)
              }
              onUnassignTraveler={(travelerId) => void assignTraveler(travelerId, null)}
              onBookingOpen={onBookingOpen}
              renderTravelerActions={renderTravelerActions}
            />
          ) : (
            <ResourceColumnsView
              kind={activeKind}
              resources={resources}
              travelers={travelers}
              occupants={occupants}
              sharingGroupLabels={data.sharingGroupLabels}
              optionNamesById={optionNamesById}
              onAssignTraveler={(travelerId, resourceId) =>
                void assignTraveler(travelerId, resourceId)
              }
              onUnassignTraveler={(travelerId) => void assignTraveler(travelerId, null)}
              onRemoveResource={(resourceId) =>
                void resourceMutation.remove.mutateAsync(resourceId)
              }
              onEditResource={editResource}
              onBookingOpen={onBookingOpen}
              renderTravelerActions={renderTravelerActions}
            />
          )}
        </>
      )}

      {renderAfter?.(context)}
    </div>
  )
}

function PassengerListPanel({
  bookings,
  sharingGroupLabels,
  onBookingOpen,
  renderTravelerActions,
  messages,
}: {
  bookings: AllocationManifestBooking[]
  sharingGroupLabels: Record<string, string>
  onBookingOpen?: (bookingId: string) => void
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
  messages: ReturnType<typeof useAllocationUiMessagesOrDefault>
}) {
  const travelerCount = bookings.reduce((sum, booking) => sum + booking.travelers.length, 0)
  const hasActions = Boolean(renderTravelerActions)

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm">{messages.exportPassengers}</h2>
            <p className="text-xs text-muted-foreground">
              {bookings.length} {messages.booking.toLowerCase()} · {travelerCount}{" "}
              {messages.travelers.toLowerCase()}
            </p>
          </div>
        </div>
      </header>

      {travelerCount === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          {messages.passengerListEmpty}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <section key={booking.id} className="overflow-hidden rounded-md border">
              <header className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {booking.bookingSequence > 0 ? (
                    <span className="text-muted-foreground text-xs tabular-nums" aria-hidden="true">
                      ({booking.bookingSequence})
                    </span>
                  ) : null}
                  {onBookingOpen ? (
                    <button
                      type="button"
                      onClick={() => onBookingOpen(booking.id)}
                      className="truncate font-medium text-sm hover:underline"
                    >
                      {booking.bookingNumber}
                    </button>
                  ) : (
                    <span className="truncate font-medium text-sm">{booking.bookingNumber}</span>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {booking.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={paymentStatusChipClass(booking.paymentStatus)}
                    title={paymentStatusTooltip(booking.paymentStatus, messages)}
                  >
                    {messages.paymentStatusLabels[booking.paymentStatus]}
                  </Badge>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {booking.travelers.length}/{booking.pax ?? booking.travelers.length}
                </Badge>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messages.travelers}</TableHead>
                    <TableHead className="w-40">{messages.sharingGroup}</TableHead>
                    <TableHead className="w-40">{messages.resources}</TableHead>
                    {hasActions ? <TableHead className="w-12" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {booking.travelers.map((traveler) => (
                    <TableRow key={traveler.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {traveler.isLeadTraveler ? (
                            <Crown
                              className="size-3.5 shrink-0 text-amber-500"
                              aria-label={messages.lead}
                            />
                          ) : null}
                          <span className="truncate font-medium text-sm">{traveler.fullName}</span>
                          {traveler.isPrimary ? (
                            <Badge variant="outline" className="text-[10px]">
                              {messages.lead}
                            </Badge>
                          ) : null}
                          {traveler.travelerCategory ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {traveler.travelerCategory}
                            </Badge>
                          ) : null}
                          {traveler.hasAccessibilityNeeds ? (
                            <Accessibility
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label={messages.accessibility}
                            />
                          ) : null}
                          {traveler.hasDietaryRequirements ? (
                            <UtensilsCrossed
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label={messages.dietary}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {traveler.sharingGroupId
                          ? (sharingGroupLabels[traveler.sharingGroupId] ?? messages.sharingGroup)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[traveler.roomTypeId, traveler.bedPreference]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      {hasActions ? (
                        <TableCell className="text-right">
                          {renderTravelerActions?.(traveler)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

function CapacitySummaryBadges({
  summary,
  messages,
  kind,
}: {
  summary: ResourceCapacitySummary
  messages: ReturnType<typeof useAllocationUiMessagesOrDefault>
  kind: string
}) {
  if (summary.resourceCount === 0 && summary.slotPax == null) return null

  // i18n-literal-ok numeric layout with separator
  const slotLabel =
    summary.slotPax == null
      ? messages.slotCapacityUnlimited
      : `${summary.slotRemainingPax ?? 0} of ${summary.slotPax}`
  const resourceLabel =
    summary.slotPax == null
      ? String(summary.resourceCapacity)
      : `${summary.resourceCapacity} of ${summary.slotPax}`

  return (
    <span className="contents" data-kind={kind} title={kindLabel(kind, messages)}>
      <Badge variant="outline" className="gap-1">
        <Users className="size-3" aria-hidden="true" />
        {messages.slotCapacityLabel}: {slotLabel}
      </Badge>
      <Badge variant="outline" className="gap-1">
        {messages.resourceCapacityLabel}: {resourceLabel}
      </Badge>
    </span>
  )
}
