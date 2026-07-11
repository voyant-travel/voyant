import type { SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type BookingScheduleRoutesOptions,
  generatePaymentScheduleForBooking,
} from "../payment-schedule/routes.js"
import { settleCoveredBookingPaymentSchedules } from "../service-shared.js"

export const FINANCE_BOOKING_SCHEDULE_SUBSCRIBER_ID =
  "@voyant-travel/finance#subscriber.booking-schedule-confirmed"

export interface BookingScheduleSubscriberRuntimeOptions<TBindings = unknown> {
  resolveRoutesOptions(
    bindings: TBindings,
  ): BookingScheduleRoutesOptions | Promise<BookingScheduleRoutesOptions>
  /** Resolve the deployment database and retain ownership of its lifecycle. */
  withDb<T>(bindings: TBindings, operation: (db: PostgresJsDatabase) => Promise<T>): Promise<T>
  generateSchedule?: typeof generatePaymentScheduleForBooking
  settleCoveredSchedules?: typeof settleCoveredBookingPaymentSchedules
  logger?: Pick<Console, "error">
}

interface BookingConfirmedPayload {
  bookingId: string
  bookingNumber: string
  actorId: string | null
}

/** Build the executable descriptor without activating it in the package manifest. */
export function createBookingScheduleSubscriberRuntime<TBindings = unknown>(
  options: BookingScheduleSubscriberRuntimeOptions<TBindings>,
): SubscriberRuntimeDescriptor {
  const generateSchedule = options.generateSchedule ?? generatePaymentScheduleForBooking
  const settleCoveredSchedules =
    options.settleCoveredSchedules ?? settleCoveredBookingPaymentSchedules
  const logger = options.logger ?? console

  return {
    id: FINANCE_BOOKING_SCHEDULE_SUBSCRIBER_ID,
    eventType: "booking.confirmed",
    register: ({ bindings, eventBus }) => {
      const runtimeBindings = bindings as TBindings
      eventBus.subscribe<BookingConfirmedPayload>("booking.confirmed", async ({ data }) => {
        try {
          const routesOptions = await options.resolveRoutesOptions(runtimeBindings)
          await options.withDb(runtimeBindings, async (db) => {
            await generateSchedule(db, data.bookingId, routesOptions)
            await settleCoveredSchedules(db, data.bookingId)
          })
        } catch (error) {
          logger.error("[booking-schedule] failed to generate schedule", {
            bookingId: data.bookingId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    },
  }
}
