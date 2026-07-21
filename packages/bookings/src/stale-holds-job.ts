import { definePort, type VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"

import { expireStaleBookingHolds } from "./tasks/expire-stale-holds.js"
import type { BookingsExpireStaleHoldsJobRuntime } from "./job-runtime.js"

export const bookingsStaleHoldsJobRuntimePort =
  definePort<BookingsExpireStaleHoldsJobRuntime>({
    id: "bookings.stale-holds-job",
    test(runtime) {
      if (!runtime || typeof runtime.resolveDb !== "function") {
        throw new Error("bookings.stale-holds-job provider must implement resolveDb().")
      }
    },
  })

/** Expire every durable booking hold whose domain cutoff has passed. */
export async function runBookingsExpireStaleHoldsJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(bookingsStaleHoldsJobRuntimePort)
  const db = await runtime.resolveDb()
  const serviceRuntime = (await runtime.resolveRuntime?.(db, {})) ?? {}
  await expireStaleBookingHolds(db, {}, runtime.userId ?? "system", serviceRuntime)
}
