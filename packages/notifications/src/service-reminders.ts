import { bookings, bookingTravelers } from "@voyantjs/bookings/schema"
import { bookingPaymentSchedules } from "@voyantjs/finance"
import { and, desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { notificationReminderRuns } from "./schema.js"
import { sendInvoiceNotification, sendNotification } from "./service-deliveries.js"
import {
  bookingStatusSkipReason,
  getBookingPaymentNotificationContext,
  OPEN_PAYMENT_SCHEDULE_STATUSES,
  PAYABLE_BOOKING_STATUSES,
  paymentScheduleStatusSkipReason,
  serializeBookingPaymentContext,
} from "./service-reminder-booking-context.js"
import {
  type ChannelOverride,
  getReminderRuleById,
  getReminderRunById,
  markReminderRunFailed,
  markReminderRunSent,
  markReminderRunSkipped,
  type NotificationReminderRunRow,
  type ReminderDeliveryEnqueuer,
  resolveChannelOverride,
} from "./service-reminder-run-state.js"
import {
  queueStageBasedDueReminders,
  runStageBasedDueReminders,
} from "./service-reminder-stage-runs.js"
import type {
  NotificationReminderRuleRow,
  NotificationService,
  RunDueRemindersInput,
} from "./service-shared.js"
import { listBookingNotificationItems, resolveReminderRecipient } from "./service-shared.js"

export {
  type BookingEventReminderRuntimeOptions,
  bookingIsPaidInFullForNotification,
  dispatchReminderEventRules,
} from "./service-reminder-events.js"
export {
  queueStageBasedDueReminders,
  runStageBasedDueReminders,
} from "./service-reminder-stage-runs.js"

async function sendQueuedBookingPaymentScheduleReminder(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  run: NotificationReminderRunRow,
  rule: NotificationReminderRuleRow,
  now: Date,
  channelOverride: ChannelOverride,
) {
  const [schedule] = await db
    .select()
    .from(bookingPaymentSchedules)
    .where(eq(bookingPaymentSchedules.id, run.targetId))
    .limit(1)

  if (!schedule) {
    return markReminderRunSkipped(
      db,
      run.id,
      now,
      "Booking payment schedule not found for reminder run",
    )
  }
  if (!OPEN_PAYMENT_SCHEDULE_STATUSES.has(schedule.status)) {
    return markReminderRunSkipped(db, run.id, now, paymentScheduleStatusSkipReason(schedule.status))
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      personId: bookings.personId,
      organizationId: bookings.organizationId,
      contactFirstName: bookings.contactFirstName,
      contactLastName: bookings.contactLastName,
      contactEmail: bookings.contactEmail,
      contactPhone: bookings.contactPhone,
      contactPreferredLanguage: bookings.contactPreferredLanguage,
      sellCurrency: bookings.sellCurrency,
      sellAmountCents: bookings.sellAmountCents,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
    })
    .from(bookings)
    .where(eq(bookings.id, schedule.bookingId))
    .limit(1)

  if (!booking) {
    return markReminderRunSkipped(db, run.id, now, "Booking not found for payment schedule")
  }
  if (!PAYABLE_BOOKING_STATUSES.has(booking.status)) {
    return markReminderRunSkipped(db, run.id, now, bookingStatusSkipReason(booking.status))
  }

  const [participants, items, paymentContext] = await Promise.all([
    db
      .select({
        id: bookingTravelers.id,
        firstName: bookingTravelers.firstName,
        lastName: bookingTravelers.lastName,
        email: bookingTravelers.email,
        participantType: bookingTravelers.participantType,
        isPrimary: bookingTravelers.isPrimary,
      })
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, booking.id))
      .orderBy(desc(bookingTravelers.isPrimary), bookingTravelers.createdAt),
    listBookingNotificationItems(db, booking.id),
    getBookingPaymentNotificationContext(db, booking.id),
  ])

  const fallbackRecipient = resolveReminderRecipient(booking, participants)
  const traveler =
    participants.find((entry) => entry.email === run.recipient) ?? fallbackRecipient ?? null
  const recipientEmail = run.recipient ?? traveler?.email ?? null

  if (!recipientEmail) {
    return markReminderRunSkipped(
      db,
      run.id,
      now,
      "No traveler email available for booking payment reminder",
    )
  }

  try {
    const delivery = await sendNotification(db, dispatcher, {
      templateId: channelOverride.templateId,
      templateSlug: channelOverride.templateSlug,
      channel: channelOverride.channel,
      provider: channelOverride.provider,
      to: recipientEmail,
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        dueDate: schedule.dueDate,
        amountCents: schedule.amountCents,
        currency: schedule.currency,
        scheduleType: schedule.scheduleType,
        traveler: traveler
          ? {
              firstName: traveler.firstName,
              lastName: traveler.lastName,
              email: recipientEmail,
              participantType: traveler.participantType,
              isPrimary: traveler.isPrimary,
            }
          : null,
        travelers: participants,
        booking: {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          startDate: booking.startDate,
          endDate: booking.endDate,
          sellCurrency: booking.sellCurrency,
          sellAmountCents: booking.sellAmountCents,
        },
        ...serializeBookingPaymentContext(paymentContext, schedule),
        items,
      },
      targetType: "booking_payment_schedule",
      targetId: schedule.id,
      bookingId: booking.id,
      personId: booking.personId ?? null,
      organizationId: booking.organizationId ?? null,
      metadata: {
        reminderRuleId: rule.id,
        reminderRunId: run.id,
      },
      scheduledFor: run.scheduledFor.toISOString(),
    })

    return markReminderRunSent(db, run.id, new Date(), delivery?.id ?? null)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification reminder failed"
    return markReminderRunFailed(db, run.id, new Date(), message)
  }
}

async function sendQueuedInvoiceReminder(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  run: NotificationReminderRunRow,
  rule: NotificationReminderRuleRow,
  now: Date,
  channelOverride: ChannelOverride,
) {
  const delivery = await sendInvoiceNotification(db, dispatcher, run.targetId, {
    templateId: channelOverride.templateId,
    templateSlug: channelOverride.templateSlug,
    channel: channelOverride.channel,
    provider: channelOverride.provider,
    to: run.recipient ?? undefined,
    data: {
      reminderRunId: run.id,
    },
    metadata: {
      reminderRuleId: rule.id,
      reminderRunId: run.id,
    },
    scheduledFor: run.scheduledFor.toISOString(),
  })

  if (!delivery) {
    return markReminderRunSkipped(db, run.id, now, "Invoice not found for reminder run")
  }

  return markReminderRunSent(db, run.id, new Date(), delivery.id ?? null)
}

export async function queueDueReminders(
  db: PostgresJsDatabase,
  input: RunDueRemindersInput = {},
  enqueueDelivery: ReminderDeliveryEnqueuer,
) {
  return queueStageBasedDueReminders(db, enqueueDelivery, input)
}

export async function deliverReminderRun(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  input: { reminderRunId: string },
) {
  const now = new Date()
  const [claimedRun] = await db
    .update(notificationReminderRuns)
    .set({
      status: "processing",
      errorMessage: null,
      processedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(notificationReminderRuns.id, input.reminderRunId),
        eq(notificationReminderRuns.status, "queued"),
      ),
    )
    .returning()

  const run = claimedRun ?? (await getReminderRunById(db, input.reminderRunId))
  if (!run) {
    return null
  }

  if (!claimedRun) {
    return run
  }

  const rule = await getReminderRuleById(db, run.reminderRuleId)
  if (!rule) {
    return markReminderRunFailed(db, run.id, new Date(), "Reminder rule not found")
  }

  const channelOverride = await resolveChannelOverride(db, run, rule)

  try {
    if (run.targetType === "booking_payment_schedule") {
      return await sendQueuedBookingPaymentScheduleReminder(
        db,
        dispatcher,
        run,
        rule,
        now,
        channelOverride,
      )
    }

    if (run.targetType === "invoice") {
      return await sendQueuedInvoiceReminder(db, dispatcher, run, rule, now, channelOverride)
    }

    return markReminderRunSkipped(db, run.id, now, "Unsupported reminder target type")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder delivery failed"
    return markReminderRunFailed(db, run.id, new Date(), message)
  }
}

export async function runDueReminders(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  input: RunDueRemindersInput = {},
) {
  return runStageBasedDueReminders(db, dispatcher, input)
}
