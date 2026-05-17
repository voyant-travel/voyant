"use client"

import type { AllocationManifestTraveler, AllocationResource } from "@voyantjs/availability-react"
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components"
import {
  Accessibility,
  Bed,
  Crown,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import {
  type AllocationOccupants,
  groupResourcesBySubType,
  kindLabel,
} from "./slot-allocation-model.js"
import { AllocationColumn } from "./slot-allocation-shared.js"

export interface EditResourceInput {
  label: string | null
  capacity: number
}

export function ResourceColumnsView({
  kind,
  resources,
  travelers,
  occupants,
  sharingGroupLabels,
  optionNamesById,
  onAssignTraveler,
  onUnassignTraveler,
  onRemoveResource,
  onEditResource,
  renderTravelerActions,
}: {
  kind: string
  resources: AllocationResource[]
  travelers: AllocationManifestTraveler[]
  occupants: AllocationOccupants
  sharingGroupLabels: Record<string, string>
  /**
   * Map from product_option_id → option name, used to badge each resource
   * row with the option it's tied to (when refType === "option"). Lets
   * operators distinguish "Standard double" rooms from "Junior suite"
   * rooms at a glance. Omit when the host doesn't have option data.
   */
  optionNamesById?: ReadonlyMap<string, string>
  /** Assign a single unallocated traveler to a specific resource. */
  onAssignTraveler: (travelerId: string, resourceId: string) => void
  /** Remove a single traveler from their current resource. */
  onUnassignTraveler: (travelerId: string) => void
  onRemoveResource: (resourceId: string) => void
  onEditResource?: (resourceId: string, input: EditResourceInput) => Promise<void> | void
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_1fr]">
      <AllocationColumn
        id="unallocated"
        icon={<Users className="size-4" aria-hidden="true" />}
        title={messages.unallocated}
        description={messages.unallocatedDescription}
        count={occupants.unallocated.length}
        capacity={travelers.length}
      >
        {occupants.unallocated.length === 0 ? (
          <p className="text-xs text-muted-foreground">{messages.unallocatedEmpty}</p>
        ) : (
          <UnallocatedTravelersTable
            travelers={occupants.unallocated}
            sharingGroupLabels={sharingGroupLabels}
            renderActions={renderTravelerActions}
          />
        )}
      </AllocationColumn>

      <div className="flex min-w-0 flex-col gap-6">
        {resources.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            {messages.noResources}
          </div>
        ) : (
          groupResourcesBySubType(resources).map((group) => {
            // The grouping function uses the raw `refId` as the label fallback.
            // Resolve product-option ids back to human names so the section
            // header reads "Standard double" instead of "POPT_01KRS8…".
            const resolvedLabel =
              (group.label ? optionNamesById?.get(group.label) : null) ?? group.label
            const groupLabel = resolvedLabel ?? messages.resourceOtherGroup
            return (
              <section key={group.key} aria-label={groupLabel} className="flex flex-col gap-2">
                <header className="flex items-baseline gap-2 border-b pb-1">
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    {groupLabel}
                  </h3>
                </header>
                <ResourceGroupTable
                  kind={kind}
                  resources={group.resources}
                  occupants={occupants}
                  unallocated={occupants.unallocated}
                  sharingGroupLabels={sharingGroupLabels}
                  optionNamesById={optionNamesById}
                  onAssignTraveler={onAssignTraveler}
                  onUnassignTraveler={onUnassignTraveler}
                  onRemoveResource={onRemoveResource}
                  onEditResource={onEditResource}
                />
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function ResourceGroupTable({
  kind,
  resources,
  occupants,
  unallocated,
  sharingGroupLabels,
  optionNamesById,
  onAssignTraveler,
  onUnassignTraveler,
  onRemoveResource,
  onEditResource,
}: {
  kind: string
  resources: AllocationResource[]
  occupants: AllocationOccupants
  unallocated: AllocationManifestTraveler[]
  sharingGroupLabels: Record<string, string>
  optionNamesById?: ReadonlyMap<string, string>
  onAssignTraveler: (travelerId: string, resourceId: string) => void
  onUnassignTraveler: (travelerId: string) => void
  onRemoveResource: (resourceId: string) => void
  onEditResource?: (resourceId: string, input: EditResourceInput) => Promise<void> | void
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-48">{messages.resourceLabel}</TableHead>
            <TableHead className="w-20 text-center">{messages.capacity}</TableHead>
            <TableHead>{messages.travelers}</TableHead>
            <TableHead className="w-40 text-right">&nbsp;</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => {
            const seated = occupants.byResource.get(resource.id) ?? []
            const isEditing = editingId === resource.id
            const isFull = seated.length >= resource.capacity
            return (
              <ResourceRow
                key={resource.id}
                kind={kind}
                resource={resource}
                seated={seated}
                unallocated={unallocated}
                sharingGroupLabels={sharingGroupLabels}
                optionName={
                  resource.refType === "option" && resource.refId
                    ? (optionNamesById?.get(resource.refId) ?? null)
                    : null
                }
                isEditing={isEditing}
                isFull={isFull}
                canEdit={Boolean(onEditResource)}
                onBeginEdit={() => setEditingId(resource.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={async (input) => {
                  await Promise.resolve(onEditResource?.(resource.id, input))
                  setEditingId(null)
                }}
                onAssignTraveler={(travelerId) => onAssignTraveler(travelerId, resource.id)}
                onUnassignTraveler={onUnassignTraveler}
                onRemoveResource={() => onRemoveResource(resource.id)}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function ResourceRow({
  kind,
  resource,
  seated,
  unallocated,
  sharingGroupLabels,
  optionName,
  isEditing,
  isFull,
  canEdit,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onAssignTraveler,
  onUnassignTraveler,
  onRemoveResource,
}: {
  kind: string
  resource: AllocationResource
  seated: AllocationManifestTraveler[]
  unallocated: AllocationManifestTraveler[]
  optionName?: string | null
  sharingGroupLabels: Record<string, string>
  isEditing: boolean
  isFull: boolean
  canEdit: boolean
  onBeginEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (input: EditResourceInput) => Promise<void>
  onAssignTraveler: (travelerId: string) => void
  onUnassignTraveler: (travelerId: string) => void
  onRemoveResource: () => void
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const overCapacity = seated.length > resource.capacity

  if (isEditing && canEdit) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={4} className="whitespace-normal">
          <ResourceEditForm
            kind={kind}
            resource={resource}
            minCapacity={Math.max(1, seated.length)}
            onCancel={onCancelEdit}
            onSave={onSaveEdit}
          />
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-2">
          <Bed className="size-4 text-muted-foreground" aria-hidden="true" />
          {resource.label ?? kindLabel(kind, messages)}
          {optionName ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {optionName}
            </Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={overCapacity ? "destructive" : "outline"}>
          {seated.length}/{resource.capacity}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-normal py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {seated.map((traveler) => (
            <TravelerChip
              key={traveler.id}
              traveler={traveler}
              sharingGroupLabel={
                traveler.sharingGroupId
                  ? (sharingGroupLabels[traveler.sharingGroupId] ?? null)
                  : null
              }
              onUnassign={() => onUnassignTraveler(traveler.id)}
            />
          ))}
          {!isFull ? (
            <AssignTravelerPopover
              unallocated={unallocated}
              seatedBookingIds={new Set(seated.map((t) => t.bookingId))}
              onSelect={(travelerId) => onAssignTraveler(travelerId)}
            />
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center justify-end gap-1">
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBeginEdit}
              aria-label={messages.editResource}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemoveResource}
            aria-label={messages.remove}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function TravelerChip({
  traveler,
  sharingGroupLabel,
  onUnassign,
}: {
  traveler: AllocationManifestTraveler
  sharingGroupLabel: string | null
  onUnassign: () => void
}) {
  const messages = useAllocationUiMessagesOrDefault()
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
      <span className="truncate font-medium" title={sharingGroupLabel ?? undefined}>
        {traveler.fullName}
      </span>
      <span className="text-muted-foreground">{traveler.bookingNumber}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-4 rounded-full"
        onClick={onUnassign}
        aria-label={`${messages.remove}: ${traveler.fullName}`}
      >
        <X className="size-3" aria-hidden="true" />
      </Button>
    </span>
  )
}

function AssignTravelerPopover({
  unallocated,
  seatedBookingIds,
  onSelect,
}: {
  unallocated: AllocationManifestTraveler[]
  /**
   * Booking ids of travelers already assigned to this resource. When set,
   * travelers from those same bookings are surfaced as a "Same booking"
   * group at the top of the picker — common case for couples / families
   * who arrive in the same booking and should share a room by default.
   */
  seatedBookingIds?: ReadonlySet<string>
  onSelect: (travelerId: string) => void
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const [open, setOpen] = useState(false)
  const disabled = unallocated.length === 0
  const sameBooking = seatedBookingIds
    ? unallocated.filter((t) => seatedBookingIds.has(t.bookingId))
    : []
  const others = seatedBookingIds
    ? unallocated.filter((t) => !seatedBookingIds.has(t.bookingId))
    : unallocated

  const renderItem = (traveler: AllocationManifestTraveler) => (
    <CommandItem
      key={traveler.id}
      value={`${traveler.fullName} ${traveler.bookingNumber}`}
      onSelect={() => {
        onSelect(traveler.id)
        setOpen(false)
      }}
    >
      <UserMinus className="mr-2 size-4 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col">
        <span className="font-medium">{traveler.fullName}</span>
        <span className="text-xs text-muted-foreground">{traveler.bookingNumber}</span>
      </div>
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={disabled}
            aria-label={messages.assignTraveler}
            title={disabled ? messages.assignTravelerEmpty : messages.assignTraveler}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {messages.assignTraveler}
          </Button>
        }
      />
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={messages.assignTravelerSearch} />
          <CommandList>
            <CommandEmpty>{messages.assignTravelerEmpty}</CommandEmpty>
            {sameBooking.length > 0 ? (
              <CommandGroup heading={messages.assignTravelerSameBooking}>
                {sameBooking.map(renderItem)}
              </CommandGroup>
            ) : null}
            {others.length > 0 ? (
              <CommandGroup
                heading={sameBooking.length > 0 ? messages.assignTravelerOthers : undefined}
              >
                {others.map(renderItem)}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ResourceEditForm({
  kind,
  resource,
  minCapacity,
  onCancel,
  onSave,
}: {
  kind: string
  resource: AllocationResource
  minCapacity: number
  onCancel: () => void
  onSave: (input: EditResourceInput) => Promise<void>
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const [label, setLabel] = useState(resource.label ?? "")
  const [capacity, setCapacity] = useState(resource.capacity)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLabel(resource.label ?? "")
    setCapacity(resource.capacity)
  }, [resource.label, resource.capacity])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = label.trim()
    const nextCapacity = Math.max(minCapacity, Math.floor(capacity) || minCapacity)
    setSaving(true)
    try {
      await onSave({
        label: trimmed.length === 0 ? null : trimmed,
        capacity: nextCapacity,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end"
      onSubmit={submit}
      aria-label={messages.editResource}
    >
      <div className="grid gap-1">
        <Label htmlFor={`edit-${resource.id}-label`} className="text-xs">
          {messages.resourceLabel}
        </Label>
        <Input
          id={`edit-${resource.id}-label`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={kindLabel(kind, messages)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`edit-${resource.id}-capacity`} className="text-xs">
          {messages.resourceCapacity}
        </Label>
        <Input
          id={`edit-${resource.id}-capacity`}
          type="number"
          min={minCapacity}
          value={capacity}
          onChange={(event) => setCapacity(Number(event.target.value) || minCapacity)}
        />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {messages.saveResource}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
        {messages.cancel}
      </Button>
    </form>
  )
}

/**
 * Dense table view of unallocated travelers. Replaces the per-row Card
 * tiles, which took multiple line-heights per traveler and made even a
 * small slot scroll. Keeps the same metadata (lead flag, sharing group,
 * accessibility / dietary icons, booking number) but in a single row.
 */
function UnallocatedTravelersTable({
  travelers,
  sharingGroupLabels,
  renderActions,
}: {
  travelers: AllocationManifestTraveler[]
  sharingGroupLabels: Record<string, string>
  renderActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const hasActions = Boolean(renderActions)
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="px-3 py-1.5 text-xs">{messages.travelers}</TableHead>
            <TableHead className="px-3 py-1.5 text-xs">&nbsp;</TableHead>
            {hasActions ? <TableHead className="w-12 px-3 py-1.5" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {travelers.map((traveler) => (
            <TableRow key={traveler.id}>
              <TableCell className="px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  {traveler.isLeadTraveler ? (
                    <Crown
                      className="size-3.5 shrink-0 text-amber-500"
                      aria-label={messages.lead}
                    />
                  ) : null}
                  <span className="truncate font-medium text-sm">{traveler.fullName}</span>
                  {traveler.sharingGroupId ? (
                    <Badge variant="secondary" className="max-w-full truncate text-[10px]">
                      {sharingGroupLabels[traveler.sharingGroupId] ?? messages.sharingGroup}
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
              <TableCell className="px-3 py-1.5 text-muted-foreground text-xs">
                {traveler.bookingNumber}
              </TableCell>
              {hasActions ? (
                <TableCell className="px-3 py-1.5 text-right">
                  {renderActions?.(traveler)}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
