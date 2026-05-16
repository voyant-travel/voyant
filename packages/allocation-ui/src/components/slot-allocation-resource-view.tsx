"use client"

import type { AllocationManifestTraveler, AllocationResource } from "@voyantjs/availability-react"
import { Badge, Button, Input, Label } from "@voyantjs/ui/components"
import { Armchair, Bed, Pencil, Trash2, Users } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import {
  type AllocationOccupants,
  groupResourcesBySubType,
  kindLabel,
  VEHICLE_SEAT_KIND,
} from "./slot-allocation-model.js"
import { DropColumn, ResourceFlagBadges, TravelerTile } from "./slot-allocation-shared.js"

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
  onDropTraveler,
  onRemoveResource,
  onEditResource,
  renderTravelerActions,
}: {
  kind: string
  resources: AllocationResource[]
  travelers: AllocationManifestTraveler[]
  occupants: AllocationOccupants
  sharingGroupLabels: Record<string, string>
  onDropTraveler: (travelerId: string, resourceId: string | null) => void
  onRemoveResource: (resourceId: string) => void
  onEditResource?: (resourceId: string, input: EditResourceInput) => Promise<void> | void
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_1fr]">
      <DropColumn
        id="unallocated"
        icon={<Users className="size-4" aria-hidden="true" />}
        title={messages.unallocated}
        description={messages.unallocatedDescription}
        count={occupants.unallocated.length}
        capacity={travelers.length}
        onDropTraveler={(travelerId) => onDropTraveler(travelerId, null)}
      >
        {occupants.unallocated.map((traveler) => (
          <TravelerTile
            key={traveler.id}
            traveler={traveler}
            sharingGroupLabel={
              traveler.sharingGroupId ? sharingGroupLabels[traveler.sharingGroupId] : null
            }
            renderActions={renderTravelerActions}
          />
        ))}
      </DropColumn>

      <div className="flex min-w-0 flex-col gap-6">
        {resources.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            {messages.noResources}
          </div>
        ) : (
          groupResourcesBySubType(resources).map((group) => (
            <section key={group.key} aria-label={group.label} className="flex flex-col gap-3">
              <header className="flex items-baseline justify-between gap-2 border-b pb-1">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                  {group.label}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {group.count} · {messages.capacity.toLowerCase()} {group.capacity}
                </span>
              </header>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {group.resources.map((resource) => (
                  <AllocationResourceColumn
                    key={resource.id}
                    kind={kind}
                    resource={resource}
                    occupants={occupants.byResource.get(resource.id) ?? []}
                    sharingGroupLabels={sharingGroupLabels}
                    onDropTraveler={(travelerId) => onDropTraveler(travelerId, resource.id)}
                    onRemoveResource={() => onRemoveResource(resource.id)}
                    onEditResource={
                      onEditResource
                        ? (input) => Promise.resolve(onEditResource(resource.id, input))
                        : undefined
                    }
                    renderTravelerActions={renderTravelerActions}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

function AllocationResourceColumn({
  kind,
  resource,
  occupants,
  onDropTraveler,
  onRemoveResource,
  onEditResource,
  sharingGroupLabels,
  renderTravelerActions,
}: {
  kind: string
  resource: AllocationResource
  occupants: AllocationManifestTraveler[]
  onDropTraveler: (travelerId: string) => void
  onRemoveResource: () => void
  onEditResource?: (input: EditResourceInput) => Promise<void>
  sharingGroupLabels: Record<string, string>
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(resource.label ?? "")
  const [capacity, setCapacity] = useState(resource.capacity)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) {
      setLabel(resource.label ?? "")
      setCapacity(resource.capacity)
    }
  }, [editing, resource.label, resource.capacity])

  const full = occupants.length >= resource.capacity
  const canEdit = Boolean(onEditResource)
  // Operator can't shrink the bucket below the number of travelers
  // already sitting in it — the API rejects that anyway, but failing
  // in the form is friendlier than a toast after the round-trip.
  const minCapacity = Math.max(1, occupants.length)

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onEditResource) return
    const trimmed = label.trim()
    const nextCapacity = Math.max(minCapacity, Math.floor(capacity) || minCapacity)
    setSaving(true)
    try {
      await onEditResource({
        label: trimmed.length === 0 ? null : trimmed,
        capacity: nextCapacity,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DropColumn
      id={`allocation-resource:${resource.id}`}
      icon={
        kind === VEHICLE_SEAT_KIND ? <Armchair className="size-4" /> : <Bed className="size-4" />
      }
      title={resource.label ?? kindLabel(kind, messages)}
      description={`${messages.capacity}: ${occupants.length}/${resource.capacity}`}
      count={occupants.length}
      capacity={resource.capacity}
      disabled={full || editing}
      onDropTraveler={onDropTraveler}
      action={
        <div className="flex items-center gap-1">
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setEditing((value) => !value)}
              aria-label={messages.editResource}
              aria-pressed={editing}
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
      }
    >
      {editing && canEdit ? (
        <form
          className="grid gap-2 rounded-md border bg-muted/40 p-2"
          onSubmit={submitEdit}
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
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              {messages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {messages.saveResource}
            </Button>
          </div>
        </form>
      ) : null}
      <ResourceFlagBadges resource={resource} />
      {full ? (
        <Badge variant="secondary" className="w-fit">
          {messages.overCapacity}
        </Badge>
      ) : null}
      {occupants.map((traveler) => (
        <TravelerTile
          key={traveler.id}
          traveler={traveler}
          sharingGroupLabel={
            traveler.sharingGroupId ? sharingGroupLabels[traveler.sharingGroupId] : null
          }
          renderActions={renderTravelerActions}
        />
      ))}
      {!full && !editing ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {messages.dropHere}
        </div>
      ) : null}
    </DropColumn>
  )
}
