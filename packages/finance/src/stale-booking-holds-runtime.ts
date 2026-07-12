import type { BookingsExpireStaleHoldsWorkflowRuntime } from "@voyant-travel/bookings/workflow-runtime"
import { and, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { closeTerminalBookingPaymentSchedules } from "./booking-lifecycle.js"
import { paymentSessions } from "./schema.js"
import { financeService } from "./service.js"

export interface FinanceStaleBookingHoldsRuntimeOptions {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  userId?: string
}

/** Finance-owned effects required when Bookings expires stale holds. */
export function createFinanceStaleBookingHoldsRuntime(
  options: FinanceStaleBookingHoldsRuntimeOptions,
): BookingsExpireStaleHoldsWorkflowRuntime {
  return {
    resolveDb: options.resolveDb,
    resolveRuntime: () => ({
      expirePaymentSessionsForBooking: async (db, bookingId) => {
        const staleSessions = await db
          .select({ id: paymentSessions.id })
          .from(paymentSessions)
          .where(
            and(
              eq(paymentSessions.bookingId, bookingId),
              inArray(paymentSessions.status, ["pending", "requires_redirect", "processing"]),
            ),
          )

        for (const session of staleSessions) {
          await financeService.expirePaymentSession(db, session.id, {
            notes: "Booking hold expired",
          })
        }
      },
      closePaymentSchedulesForBooking: closeTerminalBookingPaymentSchedules,
    }),
    userId: options.userId,
  }
}
