"use client"

import type { AllocationManifestTraveler, AllocationResource } from "@voyantjs/availability-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { Armchair, Bed, Trash2, Users } from "lucide-react"
import type { ReactNode } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import { type AllocationOccupants, kindLabel, VEHICLE_SEAT_KIND } from "./slot-allocation-model.js"
import { DropColumn, ResourceFlagBadges, TravelerTile } from "./slot-allocation-shared.js"

export function ResourceColumnsView({
  kind,
  resources,
  travelers,
  occupants,
  sharingGroupLabels,
  onDropTraveler,
  onRemoveResource,
  renderTravelerActions,
}: {
  kind: string
  resources: AllocationResource[]
  travelers: AllocationManifestTraveler[]
  occupants: AllocationOccupants
  sharingGroupLabels: Record<string, string>
  onDropTraveler: (travelerId: string, resourceId: string | null) => void
  onRemoveResource: (resourceId: string) => void
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

      <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {resources.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            {messages.noResources}
          </div>
        ) : (
          resources.map((resource) => (
            <AllocationResourceColumn
              key={resource.id}
              kind={kind}
              resource={resource}
              occupants={occupants.byResource.get(resource.id) ?? []}
              sharingGroupLabels={sharingGroupLabels}
              onDropTraveler={(travelerId) => onDropTraveler(travelerId, resource.id)}
              onRemoveResource={() => onRemoveResource(resource.id)}
              renderTravelerActions={renderTravelerActions}
            />
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
  sharingGroupLabels,
  renderTravelerActions,
}: {
  kind: string
  resource: AllocationResource
  occupants: AllocationManifestTraveler[]
  onDropTraveler: (travelerId: string) => void
  onRemoveResource: () => void
  sharingGroupLabels: Record<string, string>
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const full = occupants.length >= resource.capacity

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
      disabled={full}
      onDropTraveler={onDropTraveler}
      action={
        <Button type="button" variant="ghost" size="icon" onClick={onRemoveResource}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      }
    >
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
      {!full ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {messages.dropHere}
        </div>
      ) : null}
    </DropColumn>
  )
}
