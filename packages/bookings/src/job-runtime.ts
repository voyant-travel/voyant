import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingServiceRuntime } from "./service.js"
import type { ExpireStaleBookingHoldsInput } from "./tasks/expire-stale-holds.js"

export const BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY =
  "bookings.jobs.expire-stale-holds.runtime" as const

export interface BookingsExpireStaleHoldsJobRuntime {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  resolveRuntime?: (
    db: PostgresJsDatabase,
    input: ExpireStaleBookingHoldsInput,
  ) => BookingServiceRuntime | Promise<BookingServiceRuntime>
  userId?: string
}
