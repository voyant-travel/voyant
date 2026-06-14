import { expireStaleBookingHolds } from "@voyant-travel/bookings/tasks"
import { createDbClient } from "@voyant-travel/db"
import { financeService } from "@voyant-travel/finance"
import { paymentSessions } from "@voyant-travel/finance/schema"
import {
  createDefaultProductBrochureTemplate,
  loadProductBrochureTemplateContext,
  renderProductBrochureTemplate,
} from "@voyant-travel/inventory/tasks"
import {
  deliverQueuedNotificationReminder,
  sendDueNotificationReminders,
} from "@voyant-travel/notifications/tasks"
import { workflow } from "@voyant-travel/workflows"
import { and, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { closeTerminalBookingPaymentSchedules } from "./api/booking-payment-cleanup.js"
import { createProductBrochurePrinter } from "./lib/brochure-printer.js"
import { getNotificationTaskRuntime } from "./lib/notifications.js"

function getDb() {
  return createDbClient(process.env.DATABASE_URL!, { adapter: "node" }) as PostgresJsDatabase
}

workflow<{ productId: string }, { base64: string; filename: string; sizeBytes: number }>({
  id: "products.generate-pdf",
  defaultRuntime: "node",
  async run(input) {
    const db = getDb()
    const printer = createProductBrochurePrinter(process.env)
    const context = await loadProductBrochureTemplateContext(db, input.productId)
    const rendered = await renderProductBrochureTemplate(
      createDefaultProductBrochureTemplate(),
      context,
    )
    const printed = await printer({ template: rendered, context })
    return {
      base64: Buffer.from(printed.body).toString("base64"),
      filename: rendered.filename,
      sizeBytes: printed.fileSize ?? printed.body.byteLength,
    }
  },
})

workflow<
  { before?: string | null; note?: string | null },
  Awaited<ReturnType<typeof expireStaleBookingHolds>>
>({
  id: "bookings.expire-stale-holds",
  defaultRuntime: "node",
  schedule: { cron: "*/5 * * * *" },
  async run(input) {
    return expireStaleBookingHolds(getDb(), input, "system", {
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
    })
  },
})

const deliverReminderWorkflow = workflow<
  { reminderRunId: string },
  { reminderRunId: string; status: string | null }
>({
  id: "notifications.deliver-reminder",
  defaultRuntime: "node",
  retry: {
    max: 3,
    backoff: "exponential",
    maxDelay: "300s",
  },
  async run(input) {
    return deliverQueuedNotificationReminder(
      getDb(),
      process.env,
      input,
      getNotificationTaskRuntime(process.env),
    )
  },
})

workflow<{ now?: string | null }, Awaited<ReturnType<typeof sendDueNotificationReminders>>>({
  id: "notifications.send-due-reminders",
  defaultRuntime: "node",
  schedule: { cron: "0 * * * *" },
  async run(input, ctx) {
    return sendDueNotificationReminders(
      getDb(),
      process.env,
      input,
      getNotificationTaskRuntime(process.env, {
        enqueueReminderDelivery: async (job) => {
          await ctx.invoke(deliverReminderWorkflow, job, { detach: true })
        },
      }),
    )
  },
})
