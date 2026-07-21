import { definePort } from "@voyant-travel/core/project"
import type { BookingsExpireStaleHoldsJobRuntime } from "./job-runtime.js"

export const bookingsStaleHoldsJobRuntimePort = definePort<BookingsExpireStaleHoldsJobRuntime>({
  id: "bookings.stale-holds-job",
  test(runtime) {
    if (!runtime || typeof runtime.resolveDb !== "function") {
      throw new Error("bookings.stale-holds-job provider must implement resolveDb().")
    }
  },
})
