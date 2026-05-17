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
import { Bed, Pencil, Plus, Trash2, UserMinus, Users, X } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import {
  type AllocationOccupants,
  groupResourcesBySubType,
  kindLabel,
} from "./slot-allocation-model.js"
import { AllocationColumn, TravelerTile } from "./slot-allocation-shared.js"

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
          occupants.unallocated.map((traveler) => (
            <TravelerTile
              key={traveler.id}
              traveler={traveler}
              sharingGroupLabel={
                traveler.sharingGroupId ? sharingGroupLabels[traveler.sharingGroupId] : null
              }
              renderActions={renderTravelerActions}
            />
          ))
        )}
      </AllocationColumn>

      <div className="flex min-w-0 flex-col gap-6">
        {resources.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            {messages.noResources}
          </div>
        ) : (
          groupResourcesBySubType(resources).map((group) => {
            const groupLabel = group.label ?? messages.resourceOtherGroup
            return (
              <section key={group.key} aria-label={groupLabel} className="flex flex-col gap-2">
                <header className="flex items-baseline justify-between gap-2 border-b pb-1">
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    {groupLabel}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {group.count} · {messages.capacity.toLowerCase()} {group.capacity}
                  </span>
                </header>
                <ResourceGroupTable
                  kind={kind}
                  resources={group.resources}
                  occupants={occupants}
                  unallocated={occupants.unallocated}
                  sharingGroupLabels={sharingGroupLabels}
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
  onSelect,
}: {
  unallocated: AllocationManifestTraveler[]
  onSelect: (travelerId: string) => void
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const [open, setOpen] = useState(false)
  const disabled = unallocated.length === 0

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
            <CommandGroup>
              {unallocated.map((traveler) => (
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
              ))}
            </CommandGroup>
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
