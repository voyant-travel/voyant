/**
 * The canonical allotment lifecycle — held inventory with an option/cutoff/
 * release lifecycle and live pickup counters. Identical whether the unit is a
 * hotel room (accommodations room blocks), m² of function space (operations
 * space blocks), a coach seat, etc. — only the unit and the type-specific
 * tables differ.
 *
 * This package owns the SHARED CONTRACT (state machine + counter math + slot
 * enumeration + ledger status), reused by type-specific tables. There is no
 * single polymorphic table. See RFC voyant#1489 §4.3 / §9-Q2.
 *
 * Pure logic only — no DB or Drizzle dependency. Each consumer keeps its own
 * thin transactional service that maintains its counters in the same
 * transaction as each ledger write, guarded by table CHECK constraints.
 */

/** Block header lifecycle stages (negotiation, NOT pickup progress). */
export const ALLOTMENT_STATUSES = [
  "inquiry",
  "held",
  "confirmed",
  "released",
  "cancelled",
  "expired",
] as const

export type AllotmentStatus = (typeof ALLOTMENT_STATUSES)[number]

/** Statuses that can no longer accrue pickups. */
export const CLOSED_ALLOTMENT_STATUSES = ["released", "cancelled", "expired"] as const

export function isClosedAllotmentStatus(status: string): boolean {
  return (CLOSED_ALLOTMENT_STATUSES as readonly string[]).includes(status)
}

/** The append-only pickup ledger is compensated (reversed), never deleted. */
export const ALLOTMENT_PICKUP_STATUSES = ["active", "reversed"] as const
export type AllotmentPickupStatus = (typeof ALLOTMENT_PICKUP_STATUSES)[number]

/** Per-slot counters: held − pickedUp − released = remaining. */
export interface AllotmentCounters {
  held: number
  pickedUp: number
  released: number
}

export function allotmentRemaining(counters: AllotmentCounters): number {
  return counters.held - counters.pickedUp - counters.released
}

/** Pickup progress is DERIVED from counters at read time — never stored. */
export type PickupProgress = "none" | "partial" | "full"

export function allotmentPickupProgress(counters: AllotmentCounters): PickupProgress {
  if (counters.pickedUp === 0) return "none"
  return allotmentRemaining(counters) === 0 ? "full" : "partial"
}

/**
 * The slot dates a stay/hold occupies: each date from `start` (inclusive) to
 * `end` (exclusive). Dates are `YYYY-MM-DD`, parsed as UTC to avoid timezone
 * drift across the day boundary. One date = one allotment slot (a hotel night,
 * a space-day, …). Returns `[]` for an invalid or non-positive range.
 */
export function eachDateInRange(start: string, end: string): string[] {
  const from = new Date(`${start}T00:00:00Z`)
  const to = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return []
  const dates: string[] = []
  for (let d = from; d < to; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}
