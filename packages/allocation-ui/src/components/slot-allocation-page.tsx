"use client"

import {
  type AllocationManifestTraveler,
  useAllocationAutomationMutation,
  useAllocationResourceMutation,
  useAssignTravelerAllocationMutation,
  useProductResourceTemplates,
  useSlotAllocation,
  useSlotAllocationAuditLog,
} from "@voyantjs/availability-react"
import { Button, cn, Input, Label, Tabs, TabsList, TabsTrigger } from "@voyantjs/ui/components"
import { Armchair, ArrowLeft, Bed, Download, Plus, Sparkles, Users, Wand2 } from "lucide-react"
import { type FormEvent, type ReactNode, useMemo, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import {
  buildValidationIssues,
  collectOccupants,
  defaultCapacityFor,
  kindLabel,
  PARENT_ONLY_KINDS,
  parentKindFor,
  ROOM_KIND,
  VEHICLE_SEAT_KIND,
} from "./slot-allocation-model.js"
import { ResourceColumnsView } from "./slot-allocation-resource-view.js"
import { VehicleSeatsView } from "./slot-allocation-seat-view.js"
import { AuditLogCard, ValidationSummary } from "./slot-allocation-shared.js"

export interface SlotAllocationPageProps {
  slotId: string
  className?: string
  onBack?: () => void
  renderExtraActions?: (context: { slotId: string; kind: string }) => ReactNode
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
}

export function SlotAllocationPage({
  slotId,
  className,
  onBack,
  renderExtraActions,
  renderTravelerActions,
}: SlotAllocationPageProps) {
  const messages = useAllocationUiMessagesOrDefault()
  const allocation = useSlotAllocation({ slotId })
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

  async function swapOrAssignSeat(travelerId: string, resourceId: string) {
    const traveler = occupants.byTravelerId.get(travelerId)
    if (!traveler) return

    const currentResourceId = traveler.allocations[activeKind] ?? null
    if (currentResourceId === resourceId) return

    setError(null)
    try {
      const targetOccupant = (occupants.byResource.get(resourceId) ?? []).find(
        (occupant) => occupant.id !== travelerId,
      )
      if (targetOccupant) {
        await assignMutation.mutateAsync({
          travelerId: targetOccupant.id,
          kind: activeKind,
          resourceId: currentResourceId,
        })
      }
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

  if (!data || travelers.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 p-8", className)}>
        <Users className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{messages.empty}</p>
      </div>
    )
  }

  const isSeatMap = activeKind === VEHICLE_SEAT_KIND
  const canManuallyAddResource = !isSeatMap

  return (
    <div className={cn("flex flex-col gap-4 p-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          {onBack ? (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={messages.back}>
              <ArrowLeft data-icon aria-hidden="true" />
            </Button>
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold">{messages.pageTitle}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {data.summary.travelerCount} {messages.travelers}
              </span>
              <span>
                {resources.length} {kindLabel(activeKind, messages).toLowerCase()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renderExtraActions?.({ slotId, kind: activeKind })}
          <Button variant="outline" onClick={() => downloadExport("passengers")}>
            <Download data-icon="inline-start" aria-hidden="true" />
            {messages.exportPassengers}
          </Button>
          <Button variant="outline" onClick={() => downloadExport("rooming-list")}>
            <Download data-icon="inline-start" aria-hidden="true" />
            {messages.exportRooming}
          </Button>
          {resources.length === 0 ? (
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
          {canManuallyAddResource ? (
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
      </div>

      <Tabs value={activeKind} onValueChange={setSelectedKind}>
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
        </TabsList>
      </Tabs>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {addingResource && canManuallyAddResource ? (
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
          <Button type="submit" className="self-end" disabled={resourceMutation.create.isPending}>
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
          onDropTraveler={(travelerId, resourceId) => void swapOrAssignSeat(travelerId, resourceId)}
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
          onDropTraveler={(travelerId, resourceId) => void assignTraveler(travelerId, resourceId)}
          onRemoveResource={(resourceId) => void resourceMutation.remove.mutateAsync(resourceId)}
          renderTravelerActions={renderTravelerActions}
        />
      )}

      <AuditLogCard entries={auditLog.data?.data ?? []} />
    </div>
  )
}
