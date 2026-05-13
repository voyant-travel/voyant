import type { AllocationManifestTraveler, AllocationResource } from "@voyantjs/availability-react"

import type { AllocationUiMessages } from "../i18n/index.js"

export const ROOM_KIND = "room"
export const VEHICLE_KIND = "vehicle"
export const VEHICLE_SEAT_KIND = "vehicle_seat"
export const PARENT_ONLY_KINDS = new Set([VEHICLE_KIND])

export type AllocationOccupants = {
  byResource: Map<string, AllocationManifestTraveler[]>
  byTravelerId: Map<string, AllocationManifestTraveler>
  unallocated: AllocationManifestTraveler[]
}

export type ValidationIssue = {
  id: string
  label: string
}

export function collectOccupants(
  travelers: AllocationManifestTraveler[],
  resources: AllocationResource[],
  kind: string,
): AllocationOccupants {
  const resourceIds = new Set(resources.map((resource) => resource.id))
  const byResource = new Map<string, AllocationManifestTraveler[]>()
  const byTravelerId = new Map<string, AllocationManifestTraveler>()
  const unallocated: AllocationManifestTraveler[] = []

  for (const traveler of travelers) {
    byTravelerId.set(traveler.id, traveler)
    const resourceId = traveler.allocations[kind]
    if (!resourceId || !resourceIds.has(resourceId)) {
      unallocated.push(traveler)
      continue
    }
    const list = byResource.get(resourceId) ?? []
    list.push(traveler)
    byResource.set(resourceId, list)
  }

  return { byResource, byTravelerId, unallocated }
}

export function buildValidationIssues({
  travelers,
  resources,
  occupants,
  kind,
  messages,
}: {
  travelers: AllocationManifestTraveler[]
  resources: AllocationResource[]
  occupants: AllocationOccupants
  kind: string
  messages: AllocationUiMessages
}) {
  const issues: ValidationIssue[] = []

  if (occupants.unallocated.length > 0) {
    issues.push({
      id: "unallocated",
      label: `${occupants.unallocated.length} ${messages.validationUnallocated}`,
    })
  }

  for (const resource of resources) {
    const count = occupants.byResource.get(resource.id)?.length ?? 0
    if (count > resource.capacity) {
      issues.push({
        id: `over-capacity:${resource.id}`,
        label: `${resource.label ?? kindLabel(kind, messages)} ${messages.validationOverCapacity}`,
      })
    }
  }

  for (const splitGroup of splitSharingGroups(travelers, kind)) {
    issues.push({
      id: `split:${splitGroup}`,
      label: `${messages.validationSplitGroup}: ${splitGroup}`,
    })
  }

  return issues
}

export function splitSharingGroups(travelers: AllocationManifestTraveler[], kind: string) {
  const allocationsByGroup = new Map<string, Set<string>>()
  for (const traveler of travelers) {
    const groupId = traveler.sharingGroupId
    if (!groupId) continue
    const allocations = allocationsByGroup.get(groupId) ?? new Set<string>()
    allocations.add(traveler.allocations[kind] ?? "unallocated")
    allocationsByGroup.set(groupId, allocations)
  }

  const split: string[] = []
  for (const [groupId, allocations] of allocationsByGroup) {
    if (allocations.size > 1) split.push(groupId)
  }
  return split
}

export function groupSeatsByVehicle(
  seats: AllocationResource[],
  vehicles: AllocationResource[],
  messages: AllocationUiMessages,
) {
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const grouped = new Map<
    string,
    { id: string; label: string; sortOrder: number; seats: AllocationResource[] }
  >()

  for (const seat of seats) {
    const parentId = seat.parentId ?? "ungrouped"
    const parent = parentId === "ungrouped" ? null : vehiclesById.get(parentId)
    const group =
      grouped.get(parentId) ??
      grouped
        .set(parentId, {
          id: parentId,
          label: parent?.label ?? messages.vehicle,
          sortOrder: parent?.sortOrder ?? 0,
          seats: [],
        })
        .get(parentId)

    group?.seats.push(seat)
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      seats: group.seats.sort(compareSeatResources),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
}

export function seatRows(seats: AllocationResource[]) {
  const byRow = new Map<string, AllocationResource[]>()
  for (const seat of seats) {
    const rowKey = String(flagNumber(seat.flags.row) ?? 0)
    const row = byRow.get(rowKey) ?? []
    row.push(seat)
    byRow.set(rowKey, row)
  }

  return Array.from(byRow.entries())
    .map(([rowKey, rowSeats]) => ({
      rowKey,
      seats: rowSeats.sort(compareSeatResources),
    }))
    .sort((a, b) => Number(a.rowKey) - Number(b.rowKey) || a.rowKey.localeCompare(b.rowKey))
}

export function seatName(seat: AllocationResource, messages: AllocationUiMessages) {
  const row = flagNumber(seat.flags.row)
  const column = flagString(seat.flags.column)
  if (row && column) return `${row}${column}`
  return seat.label ?? messages.seat
}

export function parentKindFor(kind: string) {
  return kind === VEHICLE_SEAT_KIND ? VEHICLE_KIND : ""
}

export function defaultCapacityFor(kind: string) {
  return kind === VEHICLE_SEAT_KIND ? 1 : kind === ROOM_KIND ? 2 : 1
}

export function kindLabel(kind: string, messages: AllocationUiMessages) {
  if (kind === ROOM_KIND) return messages.rooms
  if (kind === VEHICLE_SEAT_KIND) return messages.vehicleSeats
  if (kind === "cabin") return messages.cabins
  if (kind === "flight_seat") return messages.flightSeats
  return titleCaseKind(kind)
}

export function flagString(value: unknown) {
  return typeof value === "string" ? value : null
}

function compareSeatResources(a: AllocationResource, b: AllocationResource) {
  const aRow = flagNumber(a.flags.row) ?? 0
  const bRow = flagNumber(b.flags.row) ?? 0
  const aColumn = flagString(a.flags.column) ?? ""
  const bColumn = flagString(b.flags.column) ?? ""
  return aRow - bRow || aColumn.localeCompare(bColumn) || a.sortOrder - b.sortOrder
}

function titleCaseKind(kind: string) {
  return kind
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

function flagNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
