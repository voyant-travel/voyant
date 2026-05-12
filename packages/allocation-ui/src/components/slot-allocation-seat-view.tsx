"use client"

import type { AllocationManifestTraveler, AllocationResource } from "@voyantjs/availability-react"
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from "@voyantjs/ui/components"
import { Armchair, Crown, Users } from "lucide-react"
import { type DragEvent, type ReactNode, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import {
  type AllocationOccupants,
  groupSeatsByVehicle,
  seatName,
  seatRows,
} from "./slot-allocation-model.js"
import { DropColumn, SeatPositionBadge, TravelerTile } from "./slot-allocation-shared.js"

export function VehicleSeatsView({
  seats,
  vehicles,
  occupants,
  sharingGroupLabels,
  onDropTraveler,
  onUnassignTraveler,
  renderTravelerActions,
}: {
  seats: AllocationResource[]
  vehicles: AllocationResource[]
  occupants: AllocationOccupants
  sharingGroupLabels: Record<string, string>
  onDropTraveler: (travelerId: string, resourceId: string) => void
  onUnassignTraveler: (travelerId: string) => void
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const groups = groupSeatsByVehicle(seats, vehicles)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_1fr]">
      <DropColumn
        id="unallocated"
        icon={<Users className="size-4" aria-hidden="true" />}
        title={messages.unallocated}
        description={messages.unallocatedDescription}
        count={occupants.unallocated.length}
        capacity={occupants.byTravelerId.size}
        onDropTraveler={onUnassignTraveler}
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

      <div className="grid min-w-0 gap-4">
        {seats.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            {messages.noSeats}
          </div>
        ) : (
          groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <Armchair className="size-4" aria-hidden="true" />
                  <span>{group.label}</span>
                  <Badge variant="outline">
                    {
                      group.seats.filter(
                        (seat) => (occupants.byResource.get(seat.id) ?? []).length > 0,
                      ).length
                    }
                    /{group.seats.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {seatRows(group.seats).map((row) => (
                    <div
                      key={row.rowKey}
                      className="grid items-stretch gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${row.seats.length}, minmax(4.25rem, 1fr))`,
                      }}
                    >
                      {row.seats.map((seat) => {
                        const seatOccupants = occupants.byResource.get(seat.id) ?? []
                        return (
                          <VehicleSeatCell
                            key={seat.id}
                            seat={seat}
                            occupant={seatOccupants[0] ?? null}
                            overflow={seatOccupants.length > 1}
                            sharingGroupLabel={
                              seatOccupants[0]?.sharingGroupId
                                ? sharingGroupLabels[seatOccupants[0].sharingGroupId]
                                : null
                            }
                            onDropTraveler={(travelerId) => onDropTraveler(travelerId, seat.id)}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function VehicleSeatCell({
  seat,
  occupant,
  overflow,
  sharingGroupLabel,
  onDropTraveler,
}: {
  seat: AllocationResource
  occupant: AllocationManifestTraveler | null
  overflow: boolean
  sharingGroupLabel?: string | null
  onDropTraveler: (travelerId: string) => void
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const [over, setOver] = useState(false)

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setOver(false)
    const travelerId = event.dataTransfer.getData("text/plain")
    if (travelerId) onDropTraveler(travelerId)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: issue #696; this cell is a drag-and-drop target, not a button or table cell.
    <div
      id={`seat:${seat.id}`}
      className={cn(
        "min-h-24 rounded-md border bg-background p-2 text-left text-xs transition-colors",
        over ? "border-primary bg-primary/5" : null,
        overflow ? "border-destructive bg-destructive/5" : null,
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{seat.label ?? seatName(seat)}</span>
        <SeatPositionBadge seat={seat} />
      </div>
      {occupant ? (
        <div className="mt-2 min-w-0">
          <div className="flex items-center gap-1">
            {occupant.isLeadTraveler ? (
              <Crown className="size-3 text-amber-500" aria-label={messages.lead} />
            ) : null}
            <span className="truncate font-medium">{occupant.fullName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-muted-foreground">
            <span>{occupant.bookingNumber}</span>
            {sharingGroupLabel ? (
              <Badge variant="secondary" className="max-w-full truncate text-[10px]">
                {sharingGroupLabel}
              </Badge>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded border border-dashed p-2 text-muted-foreground">
          {messages.dropHere}
        </div>
      )}
    </div>
  )
}
