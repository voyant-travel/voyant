import { type SQL, sql } from "drizzle-orm"

export const ACTIVE_BOOKING_STATUSES_FOR_SLOT = [
  "on_hold",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
] as const

const activeBookingStatusesForSlot = new Set<string>(ACTIVE_BOOKING_STATUSES_FOR_SLOT)

export function activeBookingStatusesForSlotSql(): SQL {
  return sql.join(
    ACTIVE_BOOKING_STATUSES_FOR_SLOT.map((status) => sql`${status}`),
    sql`, `,
  )
}

export function isActiveBookingStatusForSlot(status: string): boolean {
  return activeBookingStatusesForSlot.has(status)
}
