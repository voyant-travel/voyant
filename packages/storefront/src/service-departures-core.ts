import {
  countStorefrontSlots,
  listDefaultItineraryIdsByProductIds,
  listMeetingPointsByProductIds,
  listStorefrontSlots,
  type StorefrontSlotResourceAvailability,
  type StorefrontSlotRow,
  type StorefrontSlotStatus,
} from "./service-boundary-sql.js"

export type SlotResourceAvailability = StorefrontSlotResourceAvailability
export type SlotRow = StorefrontSlotRow
export type SlotStatus = StorefrontSlotStatus
export {
  countStorefrontSlots as countSlots,
  listDefaultItineraryIdsByProductIds,
  listMeetingPointsByProductIds,
  listStorefrontSlots as listSlots,
}

export function normalizeIso(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
}

export function normalizeLocalDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10)
}

export function buildResourceManifest(resources: SlotResourceAvailability[]) {
  if (resources.length === 0) return null
  const totals = new Map<string, { capacity: number; assigned: number; available: number }>()
  for (const resource of resources) {
    const bucket = totals.get(resource.kind) ?? { capacity: 0, assigned: 0, available: 0 }
    bucket.capacity += resource.capacity
    bucket.assigned += resource.assigned
    bucket.available += resource.available
    totals.set(resource.kind, bucket)
  }
  return {
    kinds: [...totals.entries()].map(([kind, totals]) => ({ kind, ...totals })),
    resources: resources.map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      label: resource.label,
      refType: resource.refType,
      refId: resource.refId,
      capacity: resource.capacity,
      assigned: resource.assigned,
      available: resource.available,
      parentId: resource.parentId,
      flags: resource.flags,
    })),
  }
}

export type StorefrontProductAvailabilityState =
  | "available"
  | "sold_out"
  | "closed"
  | "cancelled"
  | "on_request"
  | "past_cutoff"
  | "too_early"
  | "unavailable"

export function todayLocalDate() {
  return new Date().toISOString().slice(0, 10)
}

export function buildAvailabilityState(args: {
  status: "open" | "closed" | "sold_out" | "cancelled" | "on_request"
  remaining: number | null
  capacity: number | null
  pastCutoff: boolean
  tooEarly: boolean
}): StorefrontProductAvailabilityState {
  if (args.status === "cancelled") return "cancelled"
  if (args.status === "closed") return "closed"
  if (args.status === "sold_out") return "sold_out"
  if (args.status === "on_request") return "on_request"
  if (args.pastCutoff) return "past_cutoff"
  if (args.tooEarly) return "too_early"
  if (args.capacity != null && args.remaining === 0) return "sold_out"

  return "available"
}

export function summarizeProductAvailability(
  departures: Array<{
    availabilityState: StorefrontProductAvailabilityState
    status: "open" | "closed" | "sold_out" | "cancelled" | "on_request"
  }>,
): StorefrontProductAvailabilityState {
  if (departures.some((departure) => departure.availabilityState === "available")) {
    return "available"
  }
  if (departures.some((departure) => departure.availabilityState === "on_request")) {
    return "on_request"
  }
  if (departures.some((departure) => departure.availabilityState === "too_early")) {
    return "too_early"
  }
  if (departures.some((departure) => departure.availabilityState === "past_cutoff")) {
    return "past_cutoff"
  }
  if (departures.some((departure) => departure.availabilityState === "sold_out")) {
    return "sold_out"
  }
  if (departures.some((departure) => departure.availabilityState === "closed")) {
    return "closed"
  }
  if (departures.some((departure) => departure.availabilityState === "cancelled")) {
    return "cancelled"
  }

  return "unavailable"
}
