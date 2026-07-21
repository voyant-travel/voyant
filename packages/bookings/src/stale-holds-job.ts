import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { bookingsStaleHoldsJobRuntimePort } from "./stale-holds-job-runtime-port.js"
import { expireStaleBookingHolds } from "./tasks/expire-stale-holds.js"

/** Expire every durable booking hold whose domain cutoff has passed. */
export async function runBookingsExpireStaleHoldsJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(bookingsStaleHoldsJobRuntimePort)
  const db = await runtime.resolveDb()
  const serviceRuntime = (await runtime.resolveRuntime?.(db, {})) ?? {}
  await expireStaleBookingHolds(db, {}, runtime.userId ?? "system", serviceRuntime)
}
