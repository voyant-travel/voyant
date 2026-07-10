import type { WorkflowDescriptor } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingServiceRuntime } from "./service.js"
import {
  type ExpireStaleBookingHoldsInput,
  type ExpireStaleBookingHoldsResult,
  expireStaleBookingHolds,
} from "./tasks/expire-stale-holds.js"

export interface CreateBookingsExpireStaleHoldsWorkflowOptions {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  resolveRuntime?: (
    db: PostgresJsDatabase,
    input: ExpireStaleBookingHoldsInput,
  ) => BookingServiceRuntime | Promise<BookingServiceRuntime>
  userId?: string
}

export const bookingsExpireStaleHoldsWorkflowManifest = {
  id: "bookings.expire-stale-holds",
  config: {
    defaultRuntime: "node" as const,
    schedule: { cron: "*/5 * * * *", name: "every-5-minutes" },
  },
} satisfies WorkflowDescriptor

/** Register stale-hold expiry while leaving finance cleanup hooks injectable. */
export function createBookingsExpireStaleHoldsWorkflow(
  options: CreateBookingsExpireStaleHoldsWorkflowOptions,
) {
  return workflow<ExpireStaleBookingHoldsInput, ExpireStaleBookingHoldsResult>({
    ...bookingsExpireStaleHoldsWorkflowManifest.config,
    id: bookingsExpireStaleHoldsWorkflowManifest.id,
    async run(input) {
      const db = await options.resolveDb()
      const runtime = (await options.resolveRuntime?.(db, input)) ?? {}
      return expireStaleBookingHolds(db, input, options.userId ?? "system", runtime)
    },
  })
}

export type { ExpireStaleBookingHoldsInput, ExpireStaleBookingHoldsResult }
