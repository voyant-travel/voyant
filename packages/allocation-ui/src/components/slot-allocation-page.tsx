"use client"

import {
  type AllocationManifestTraveler,
  type AllocationResource,
  useAllocationResourceMutation,
  useAssignTravelerAllocationMutation,
  useSlotAllocation,
} from "@voyantjs/availability-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
} from "@voyantjs/ui/components"
import {
  Accessibility,
  ArrowLeft,
  Bed,
  Crown,
  Plus,
  Trash2,
  Users,
  UtensilsCrossed,
} from "lucide-react"
import { type DragEvent, type FormEvent, type ReactNode, useMemo, useState } from "react"

import { useAllocationUiMessagesOrDefault } from "../i18n/index.js"

const ROOM_KIND = "room"

export interface SlotAllocationPageProps {
  slotId: string
  className?: string
  onBack?: () => void
  renderExtraActions?: (context: { slotId: string }) => ReactNode
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
  const resourceMutation = useAllocationResourceMutation(slotId)
  const assignMutation = useAssignTravelerAllocationMutation(slotId)
  const [addingRoom, setAddingRoom] = useState(false)
  const [roomLabel, setRoomLabel] = useState("")
  const [roomCapacity, setRoomCapacity] = useState(2)
  const [error, setError] = useState<string | null>(null)

  const data = allocation.data?.data
  const rooms = useMemo(
    () => (data?.resources ?? []).filter((resource) => resource.kind === ROOM_KIND),
    [data?.resources],
  )

  const travelers = useMemo(() => {
    const out: AllocationManifestTraveler[] = []
    for (const booking of data?.bookings ?? []) {
      if (booking.status === "cancelled") continue
      out.push(...booking.travelers)
    }
    return out
  }, [data?.bookings])

  const occupants = useMemo(() => {
    const byRoom = new Map<string, AllocationManifestTraveler[]>()
    const unallocated: AllocationManifestTraveler[] = []
    for (const traveler of travelers) {
      const roomId = traveler.allocations[ROOM_KIND]
      if (!roomId) {
        unallocated.push(traveler)
        continue
      }
      const list = byRoom.get(roomId) ?? []
      list.push(traveler)
      byRoom.set(roomId, list)
    }
    return { byRoom, unallocated }
  }, [travelers])

  async function assignTraveler(travelerId: string, resourceId: string | null) {
    setError(null)
    try {
      await assignMutation.mutateAsync({ travelerId, kind: ROOM_KIND, resourceId })
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.allocationFailed)
    }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await resourceMutation.create.mutateAsync({
        kind: ROOM_KIND,
        label: roomLabel.trim() || null,
        capacity: roomCapacity,
      })
      setRoomLabel("")
      setRoomCapacity(2)
      setAddingRoom(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.createRoomFailed)
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
            <h1 className="text-2xl font-semibold tracking-tight">{messages.pageTitle}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {data.summary.travelerCount} {messages.travelers}
              </span>
              <span>
                {rooms.length} {messages.rooms.toLowerCase()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renderExtraActions?.({ slotId })}
          <Button variant="outline" onClick={() => setAddingRoom((value) => !value)}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            {messages.addRoom}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {addingRoom ? (
        <form
          className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_8rem_auto_auto]"
          onSubmit={createRoom}
        >
          <div className="grid gap-1">
            <Label htmlFor="allocation-room-label">{messages.roomLabel}</Label>
            <Input
              id="allocation-room-label"
              value={roomLabel}
              onChange={(event) => setRoomLabel(event.target.value)}
              placeholder="102"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="allocation-room-capacity">{messages.roomCapacity}</Label>
            <Input
              id="allocation-room-capacity"
              type="number"
              min={1}
              value={roomCapacity}
              onChange={(event) => setRoomCapacity(Number(event.target.value) || 1)}
            />
          </div>
          <Button type="submit" className="self-end" disabled={resourceMutation.create.isPending}>
            {messages.createRoom}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="self-end"
            onClick={() => setAddingRoom(false)}
          >
            {messages.cancel}
          </Button>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_1fr]">
        <DropColumn
          id="unallocated"
          title={messages.unallocated}
          description={messages.unallocatedDescription}
          count={occupants.unallocated.length}
          capacity={travelers.length}
          onDropTraveler={(travelerId) => void assignTraveler(travelerId, null)}
        >
          {occupants.unallocated.map((traveler) => (
            <TravelerTile
              key={traveler.id}
              traveler={traveler}
              renderActions={renderTravelerActions}
            />
          ))}
        </DropColumn>

        <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rooms.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {messages.noRooms}
            </div>
          ) : (
            rooms.map((room) => {
              const roomOccupants = occupants.byRoom.get(room.id) ?? []
              return (
                <RoomColumn
                  key={room.id}
                  room={room}
                  occupants={roomOccupants}
                  onDropTraveler={(travelerId) => void assignTraveler(travelerId, room.id)}
                  onRemoveRoom={() => void resourceMutation.remove.mutateAsync(room.id)}
                  renderTravelerActions={renderTravelerActions}
                />
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function RoomColumn({
  room,
  occupants,
  onDropTraveler,
  onRemoveRoom,
  renderTravelerActions,
}: {
  room: AllocationResource
  occupants: AllocationManifestTraveler[]
  onDropTraveler: (travelerId: string) => void
  onRemoveRoom: () => void
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()
  const full = occupants.length >= room.capacity

  return (
    <DropColumn
      id={`room:${room.id}`}
      title={room.label ?? messages.rooms}
      description={`${messages.capacity}: ${occupants.length}/${room.capacity}`}
      count={occupants.length}
      capacity={room.capacity}
      disabled={full}
      onDropTraveler={onDropTraveler}
      action={
        <Button type="button" variant="ghost" size="icon" onClick={onRemoveRoom}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      }
    >
      {full ? (
        <Badge variant="secondary" className="w-fit">
          {messages.overCapacity}
        </Badge>
      ) : null}
      {occupants.map((traveler) => (
        <TravelerTile key={traveler.id} traveler={traveler} renderActions={renderTravelerActions} />
      ))}
      {!full ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {messages.dropHere}
        </div>
      ) : null}
    </DropColumn>
  )
}

function DropColumn({
  id,
  title,
  description,
  count,
  capacity,
  disabled,
  action,
  children,
  onDropTraveler,
}: {
  id: string
  title: string
  description: string
  count: number
  capacity: number
  disabled?: boolean
  action?: ReactNode
  children: ReactNode
  onDropTraveler: (travelerId: string) => void
}) {
  const [over, setOver] = useState(false)

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setOver(false)
    if (disabled) return
    const travelerId = event.dataTransfer.getData("text/plain")
    if (travelerId) onDropTraveler(travelerId)
  }

  return (
    <Card
      id={id}
      className={cn(
        "min-h-40 transition-colors",
        over && !disabled ? "border-primary bg-primary/5" : null,
      )}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bed className="size-4" aria-hidden="true" />
            {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={count > capacity ? "destructive" : "outline"}>
            {count}/{capacity}
          </Badge>
          {action}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  )
}

function TravelerTile({
  traveler,
  renderActions,
}: {
  traveler: AllocationManifestTraveler
  renderActions?: (traveler: AllocationManifestTraveler) => ReactNode
}) {
  const messages = useAllocationUiMessagesOrDefault()

  return (
    // biome-ignore lint/a11y/useSemanticElements: issue #696; the tile can wrap custom action controls, so it cannot be a button.
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", traveler.id)
      }}
      className="group flex cursor-grab items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm shadow-sm active:cursor-grabbing"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {traveler.isLeadTraveler ? (
            <Crown className="size-3.5 text-amber-500" aria-label={messages.lead} />
          ) : null}
          <span className="truncate font-medium">{traveler.fullName}</span>
          {traveler.sharingGroupId ? (
            <Badge variant="secondary" className="text-[10px]">
              {messages.sharingGroup}
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{traveler.bookingNumber}</span>
          {traveler.hasAccessibilityNeeds ? (
            <Accessibility className="size-3.5" aria-label={messages.accessibility} />
          ) : null}
          {traveler.hasDietaryRequirements ? (
            <UtensilsCrossed className="size-3.5" aria-label={messages.dietary} />
          ) : null}
        </div>
      </div>
      {renderActions ? <div className="shrink-0">{renderActions(traveler)}</div> : null}
    </div>
  )
}
