"use client"

import { useQuery } from "@tanstack/react-query"
import {
  type AllocationManifestTraveler,
  getSlotQueryOptions,
  type SlotAllocationManifest,
  useAllocationAutomationMutation,
  useAllocationResourceMutation,
  useAssignTravelerAllocationMutation,
  useProductResourceTemplates,
  useSlotAllocation,
  useSlotAllocationAuditLog,
  useVoyantAvailabilityContext,
} from "@voyantjs/availability-react"
import {
  Badge,
  Button,
  cn,
  Input,
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@voyantjs/ui/components"
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  Bed,
  Download,
  Plus,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react"
import { type FormEvent, type ReactNode, useMemo, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import {
  buildValidationIssues,
  collectOccupants,
  defaultCapacityFor,
  kindLabel,
  PARENT_ONLY_KINDS,
  parentKindFor,
  type ResourceCapacitySummary,
  ROOM_KIND,
  summarizeResourceCapacity,
  VEHICLE_SEAT_KIND,
} from "./slot-allocation-model.js"
import { ResourceColumnsView } from "./slot-allocation-resource-view.js"
import { VehicleSeatsView } from "./slot-allocation-seat-view.js"
import { AuditLogCard, ValidationSummary } from "./slot-allocation-shared.js"

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
  renderExtraActions?: (context: { slotId: string; kind: string }) => ReactNode
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
  renderExtraActions,
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
  const auditLog = useSlotAllocationAuditLog({ slotId })
  const resourceMutation = useAllocationResourceMutation(slotId)
  const assignMutation = useAssignTravelerAllocationMutation(slotId)
  const automationMutation = useAllocationAutomationMutation(slotId)
  const [selectedKind, setSelectedKind] = useState(ROOM_KIND)
  const [addingResource, setAddingResource] = useState(false)
  const [resourceLabel, setResourceLabel] = useState("")
  const [resourceCapacity, setResourceCapacity] = useState(2)
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
    const kinds: string[] = []
    const addKind = (kind: string | null | undefined) => {
      if (!kind || PARENT_ONLY_KINDS.has(kind) || kinds.includes(kind)) return
      kinds.push(kind)
    }

    addKind(ROOM_KIND)
    for (const resource of data?.resources ?? []) addKind(resource.kind)
    for (const option of templates.data?.data ?? []) {
      for (const template of option.templates) addKind(template.kind)
    }

    return kinds
  }, [data?.resources, templates.data?.data])

  const activeKind = allocationKinds.includes(selectedKind)
    ? selectedKind
    : (allocationKinds[0] ?? ROOM_KIND)
  const visibleExtraTabs = extraTabs.filter((tab) => !allocationKinds.includes(tab.id))
  const selectedExtraTab = allocationKinds.includes(selectedKind)
    ? undefined
    : visibleExtraTabs.find((tab) => tab.id === selectedKind)
  const activeTabId = selectedExtraTab?.id ?? activeKind
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
  const validationIssues = useMemo(
    () => buildValidationIssues({ travelers, resources, occupants, kind: activeKind, messages }),
    [travelers, resources, occupants, activeKind, messages],
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

  function downloadExport(kind: "passengers" | "rooming-list") {
    globalThis.location.assign(
      `/v1/admin/availability/slots/${encodeURIComponent(slotId)}/allocation/export-${kind}`,
    )
  }

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
      })
      setResourceLabel("")
      setResourceCapacity(defaultCapacityFor(activeKind))
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
      await automationMutation.autoMaterialize.mutateAsync({ kind: activeKind })
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
      <span>
        {data.summary.travelerCount} {messages.travelers}
      </span>
      {selectedExtraTab ? null : (
        <span>
          {resources.length} {kindLabel(activeKind, messages).toLowerCase()}
        </span>
      )}
      {selectedExtraTab ? null : (
        <CapacitySummaryBadges summary={capacitySummary} messages={messages} kind={activeKind} />
      )}
    </div>
  )

  const actionsCluster = (
    <div className="flex flex-wrap items-center gap-2">
      {selectedExtraTab ? null : renderExtraActions?.({ slotId, kind: activeKind })}
      <Button variant="outline" onClick={() => downloadExport("passengers")}>
        <Download data-icon="inline-start" aria-hidden="true" />
        {messages.exportPassengers}
      </Button>
      <Button variant="outline" onClick={() => downloadExport("rooming-list")}>
        <Download data-icon="inline-start" aria-hidden="true" />
        {messages.exportRooming}
      </Button>
      {selectedExtraTab ? null : resources.length === 0 ? (
        <Button
          variant="outline"
          onClick={() => void generateResources()}
          disabled={automationMutation.autoMaterialize.isPending}
        >
          <Sparkles data-icon="inline-start" aria-hidden="true" />
          {automationMutation.autoMaterialize.isPending
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
      {!selectedExtraTab && canManuallyAddResource ? (
        <Button
          variant="outline"
          onClick={() => {
            setResourceCapacity(defaultCapacityFor(activeKind))
            setAddingResource((value) => !value)
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

      {selectedExtraTab ? (
        selectedExtraTab.render(context)
      ) : (
        <>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {addingResource && canManuallyAddResource ? (
            <div className="flex flex-col gap-2">
              <form
                className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_8rem_auto_auto]"
                onSubmit={createResource}
              >
                <div className="grid gap-1">
                  <Label htmlFor="allocation-resource-label">{messages.resourceLabel}</Label>
                  <Input
                    id="allocation-resource-label"
                    value={resourceLabel}
                    onChange={(event) => setResourceLabel(event.target.value)}
                    placeholder={activeKind === ROOM_KIND ? "102" : kindLabel(activeKind, messages)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="allocation-resource-capacity">{messages.resourceCapacity}</Label>
                  <Input
                    id="allocation-resource-capacity"
                    type="number"
                    min={1}
                    value={resourceCapacity}
                    onChange={(event) => setResourceCapacity(Number(event.target.value) || 1)}
                  />
                </div>
                <Button
                  type="submit"
                  className="self-end"
                  disabled={resourceMutation.create.isPending}
                >
                  {messages.createResource}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="self-end"
                  onClick={() => setAddingResource(false)}
                >
                  {messages.cancel}
                </Button>
              </form>
              {projectedSummary?.status === "over" && projectedSummary.delta != null ? (
                <div
                  className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
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
            </div>
          ) : null}

          <ValidationSummary
            issues={validationIssues}
            resources={resources}
            unallocatedCount={occupants.unallocated.length}
          />

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
              renderTravelerActions={renderTravelerActions}
            />
          ) : (
            <ResourceColumnsView
              kind={activeKind}
              resources={resources}
              travelers={travelers}
              occupants={occupants}
              sharingGroupLabels={data.sharingGroupLabels}
              onAssignTraveler={(travelerId, resourceId) =>
                void assignTraveler(travelerId, resourceId)
              }
              onUnassignTraveler={(travelerId) => void assignTraveler(travelerId, null)}
              onRemoveResource={(resourceId) =>
                void resourceMutation.remove.mutateAsync(resourceId)
              }
              onEditResource={editResource}
              renderTravelerActions={renderTravelerActions}
            />
          )}
        </>
      )}

      {renderAfter?.(context)}

      <AuditLogCard entries={auditLog.data?.data ?? []} />
    </div>
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

  const slotLabel =
    summary.slotPax == null
      ? messages.slotCapacityUnlimited
      : `${summary.slotRemainingPax ?? 0}/${summary.slotPax}`
  const resourceLabel =
    summary.slotPax == null
      ? String(summary.resourceCapacity)
      : `${summary.resourceCapacity}/${summary.slotPax}`

  const deltaVariant =
    summary.status === "over"
      ? "destructive"
      : summary.status === "exact"
        ? "default"
        : summary.status === "fits"
          ? "secondary"
          : "outline"
  const deltaLabel =
    summary.status === "over"
      ? `${messages.resourceCapacityOver}: ${summary.delta ?? 0}`
      : summary.status === "exact"
        ? messages.resourceCapacityExact
        : summary.status === "fits"
          ? messages.resourceCapacityFits
          : null

  return (
    <span className="contents" data-kind={kind} title={kindLabel(kind, messages)}>
      <Badge variant="outline" className="gap-1">
        <Users className="size-3" aria-hidden="true" />
        {messages.slotCapacityLabel}: {slotLabel}
      </Badge>
      <Badge variant="outline" className="gap-1">
        {messages.resourceCapacityLabel}: {resourceLabel}
      </Badge>
      {deltaLabel ? <Badge variant={deltaVariant}>{deltaLabel}</Badge> : null}
    </span>
  )
}
