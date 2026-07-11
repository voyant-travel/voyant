import type { WorkflowDescriptor } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import {
  type ExpireStaleBookingHoldsInput,
  type ExpireStaleBookingHoldsResult,
  expireStaleBookingHolds,
} from "./tasks/expire-stale-holds.js"
import type { BookingsExpireStaleHoldsWorkflowRuntime } from "./workflow-runtime.js"

export type CreateBookingsExpireStaleHoldsWorkflowOptions = BookingsExpireStaleHoldsWorkflowRuntime

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
      return runExpireStaleBookingHolds(options, input)
    },
  })
}

async function runExpireStaleBookingHolds(
  options: BookingsExpireStaleHoldsWorkflowRuntime,
  input: ExpireStaleBookingHoldsInput,
): Promise<ExpireStaleBookingHoldsResult> {
  const db = await options.resolveDb()
  const runtime = (await options.resolveRuntime?.(db, input)) ?? {}
  return expireStaleBookingHolds(db, input, options.userId ?? "system", runtime)
}

export type { ExpireStaleBookingHoldsInput, ExpireStaleBookingHoldsResult }
