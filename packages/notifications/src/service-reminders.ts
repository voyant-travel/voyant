import { bookings, bookingTravelers } from "@voyantjs/bookings/schema"
import { bookingPaymentSchedules, invoices, paymentSessions } from "@voyantjs/finance"
import { and, asc, desc, eq, gt, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type NotificationReminderRuleStage,
  type NotificationReminderStageChannel,
  type NotificationSettings,
  notificationReminderRules,
  notificationReminderRuns,
} from "./schema.js"
import {
  type BookingDocumentAttachmentResolver,
  bookingDocumentNotificationsService,
  createDefaultBookingDocumentAttachment,
} from "./service-booking-documents.js"
import { sendInvoiceNotification, sendNotification } from "./service-deliveries.js"
import {
  applyQuietHours,
  evaluateStage,
  exceedsRecipientRateLimit,
  fetchTargetsForRule,
  getNotificationSettings,
  listActiveRulesByPriority,
  listChannelsForStage,
  listStagesForRule,
  loadHistory,
  type ReminderTargetSnapshot,
  suppressedByGroup,
} from "./service-sequence.js"
import type {
  BookingDocumentBundleItem,
  BookingPaymentScheduleRow,
  NotificationReminderRuleRow,
  NotificationService,
  ReminderQueueResult,
  ReminderSweepResult,
  RunDueRemindersInput,
} from "./service-shared.js"
import {
  buildReminderDedupeKey,
  listBookingNotificationItems,
  resolveReminderRecipient,
  startOfUtcDay,
  toDateString,
  toTimestamp,
} from "./service-shared.js"
import type { NotificationAttachment } from "./types.js"

type ReminderDeliveryEnqueuer = (input: { reminderRunId: string }) => Promise<void>

type NotificationReminderRunRow = typeof notificationReminderRuns.$inferSelect
type ReminderTargetType = NotificationReminderRuleRow["targetType"]
type BookingEventReminderTargetType = Extract<
  ReminderTargetType,
  "booking_confirmed" | "payment_complete" | "booking_cancelled_non_payment"
>

export interface BookingEventReminderRuntimeOptions {
  documentAttachmentResolver?: BookingDocumentAttachmentResolver
}

async function getBookingPaymentNotificationContext(db: PostgresJsDatabase, bookingId: string) {
  const [[paymentSchedule], [invoice], [paymentSession]] = await Promise.all([
    db
      .select()
      .from(bookingPaymentSchedules)
      .where(
        and(
          eq(bookingPaymentSchedules.bookingId, bookingId),
          or(
            eq(bookingPaymentSchedules.status, "pending"),
            eq(bookingPaymentSchedules.status, "due"),
          ),
        ),
      )
      .orderBy(asc(bookingPaymentSchedules.dueDate), asc(bookingPaymentSchedules.createdAt))
      .limit(1),
    db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .orderBy(desc(invoices.createdAt))
      .limit(1),
    db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.bookingId, bookingId))
      .orderBy(desc(paymentSessions.createdAt))
      .limit(1),
  ])

  return {
    paymentSchedule: paymentSchedule ?? null,
    invoice: invoice ?? null,
    paymentSession: paymentSession ?? null,
  }
}

async function getBookingEventDocumentContext(
  db: PostgresJsDatabase,
  bookingId: string,
  attachmentResolver?: BookingDocumentAttachmentResolver,
): Promise<{
  documents: BookingDocumentBundleItem[]
  attachments: NotificationAttachment[]
}> {
  const bundle = await bookingDocumentNotificationsService.listBookingDocumentBundle(db, bookingId)
  const documents = bundle?.documents ?? []
  if (documents.length === 0) {
    return { documents, attachments: [] }
  }

  const resolver =
    attachmentResolver ??
    (async (document: BookingDocumentBundleItem) =>
      createDefaultBookingDocumentAttachment(document))
  const attachments = (await Promise.all(documents.map((document) => resolver(document)))).filter(
    (attachment): attachment is NotificationAttachment => Boolean(attachment),
  )

  return { documents, attachments }
}

function serializeBookingPaymentContext(
  context: Awaited<ReturnType<typeof getBookingPaymentNotificationContext>>,
  paymentScheduleOverride?: BookingPaymentScheduleRow | null,
) {
  const schedule = paymentScheduleOverride ?? context.paymentSchedule

  return {
    invoice: context.invoice
      ? {
          id: context.invoice.id,
          invoiceNumber: context.invoice.invoiceNumber,
          invoiceType: context.invoice.invoiceType,
          status: context.invoice.status,
          currency: context.invoice.currency,
          subtotalCents: context.invoice.subtotalCents,
          taxCents: context.invoice.taxCents,
          totalCents: context.invoice.totalCents,
          paidCents: context.invoice.paidCents,
          balanceDueCents: context.invoice.balanceDueCents,
          issueDate: context.invoice.issueDate,
          dueDate: context.invoice.dueDate,
        }
      : null,
    paymentSession: context.paymentSession
      ? {
          id: context.paymentSession.id,
          status: context.paymentSession.status,
          provider: context.paymentSession.provider,
          currency: context.paymentSession.currency,
          amountCents: context.paymentSession.amountCents,
          redirectUrl: context.paymentSession.redirectUrl,
          returnUrl: context.paymentSession.returnUrl,
          cancelUrl: context.paymentSession.cancelUrl,
          expiresAt: context.paymentSession.expiresAt,
          paymentMethod: context.paymentSession.paymentMethod,
          externalReference: context.paymentSession.externalReference,
        }
      : null,
    paymentSchedule: schedule
      ? {
          id: schedule.id,
          dueDate: schedule.dueDate,
          amountCents: schedule.amountCents,
          currency: schedule.currency,
          scheduleType: schedule.scheduleType,
          status: schedule.status,
        }
      : null,
  }
}

async function hasOutstandingBookingBalance(db: PostgresJsDatabase, bookingId: string) {
  const [openSchedule] = await db
    .select({ id: bookingPaymentSchedules.id })
    .from(bookingPaymentSchedules)
    .where(
      and(
        eq(bookingPaymentSchedules.bookingId, bookingId),
        or(
          eq(bookingPaymentSchedules.status, "pending"),
          eq(bookingPaymentSchedules.status, "due"),
        ),
      ),
    )
    .limit(1)

  if (openSchedule) {
    return true
  }

  const [openInvoice] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.bookingId, bookingId),
        gt(invoices.balanceDueCents, 0),
        or(
          eq(invoices.status, "sent"),
          eq(invoices.status, "partially_paid"),
          eq(invoices.status, "overdue"),
        ),
      ),
    )
    .limit(1)

  return Boolean(openInvoice)
}

function buildReminderSweepSummary(): ReminderSweepResult {
  return {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  }
}

function buildReminderQueueSummary(): ReminderQueueResult {
  return {
    processed: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
  }
}

async function getReminderRuleById(db: PostgresJsDatabase, reminderRuleId: string) {
  const [rule] = await db
    .select()
    .from(notificationReminderRules)
    .where(eq(notificationReminderRules.id, reminderRuleId))
    .limit(1)
  return rule ?? null
}

async function getReminderRunById(db: PostgresJsDatabase, reminderRunId: string) {
  const [run] = await db
    .select()
    .from(notificationReminderRuns)
    .where(eq(notificationReminderRuns.id, reminderRunId))
    .limit(1)
  return run ?? null
}

async function markReminderRunSkipped(
  db: PostgresJsDatabase,
  reminderRunId: string,
  now: Date,
  errorMessage: string,
) {
  const [run] = await db
    .update(notificationReminderRuns)
    .set({
      status: "skipped",
      errorMessage,
      processedAt: now,
      updatedAt: now,
    })
    .where(eq(notificationReminderRuns.id, reminderRunId))
    .returning()

  return run ?? null
}

async function markReminderRunFailed(
  db: PostgresJsDatabase,
  reminderRunId: string,
  now: Date,
  errorMessage: string,
) {
  const [run] = await db
    .update(notificationReminderRuns)
    .set({
      status: "failed",
      errorMessage,
      processedAt: now,
      updatedAt: now,
    })
    .where(eq(notificationReminderRuns.id, reminderRunId))
    .returning()

  return run ?? null
}

async function markReminderRunSent(
  db: PostgresJsDatabase,
  reminderRunId: string,
  now: Date,
  notificationDeliveryId: string | null,
) {
  const [run] = await db
    .update(notificationReminderRuns)
    .set({
      notificationDeliveryId,
      status: "sent",
      processedAt: now,
      updatedAt: now,
      errorMessage: null,
    })
    .where(eq(notificationReminderRuns.id, reminderRunId))
    .returning()

  return run ?? null
}

async function sendQueuedBookingPaymentScheduleReminder(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  run: NotificationReminderRunRow,
  rule: NotificationReminderRuleRow,
  now: Date,
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

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, schedule.bookingId))
    .limit(1)

  if (!booking) {
    return markReminderRunSkipped(db, run.id, now, "Booking not found for payment schedule")
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
      templateId: rule.templateId ?? null,
      templateSlug: rule.templateSlug ?? null,
      channel: rule.channel,
      provider: rule.provider ?? null,
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
) {
  const delivery = await sendInvoiceNotification(db, dispatcher, run.targetId, {
    templateId: rule.templateId ?? null,
    templateSlug: rule.templateSlug ?? null,
    channel: rule.channel,
    provider: rule.provider ?? null,
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

async function sendBookingEventReminder(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  rule: NotificationReminderRuleRow,
  input: {
    targetType: BookingEventReminderTargetType
    bookingId: string
    paymentSessionId?: string | null
    eventData?: Record<string, unknown>
  },
  runtime: BookingEventReminderRuntimeOptions = {},
) {
  const now = new Date()
  const dedupeKey = buildReminderDedupeKey(rule.id, input.bookingId, input.targetType)

  const [existingRun] = await db
    .select({ id: notificationReminderRuns.id })
    .from(notificationReminderRuns)
    .where(eq(notificationReminderRuns.dedupeKey, dedupeKey))
    .limit(1)
  if (existingRun) {
    return null
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1)
  if (!booking) {
    const [run] = await db
      .insert(notificationReminderRuns)
      .values({
        reminderRuleId: rule.id,
        targetType: input.targetType,
        targetId: input.bookingId,
        dedupeKey,
        bookingId: input.bookingId,
        personId: null,
        organizationId: null,
        paymentSessionId: input.paymentSessionId ?? null,
        notificationDeliveryId: null,
        status: "skipped",
        recipient: null,
        scheduledFor: now,
        processedAt: now,
        errorMessage: "Booking not found for notification event",
        metadata: {
          eventTargetType: input.targetType,
          ...(input.eventData ?? {}),
        },
      })
      .returning()
    return run ?? null
  }

  const [participants, items, paymentContext, documentContext] = await Promise.all([
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
    input.targetType === "booking_confirmed" && rule.channel === "email"
      ? getBookingEventDocumentContext(db, booking.id, runtime.documentAttachmentResolver)
      : Promise.resolve({ documents: [], attachments: [] }),
  ])

  const recipient = resolveReminderRecipient(booking, participants)
  const [processingRun] = await db
    .insert(notificationReminderRuns)
    .values({
      reminderRuleId: rule.id,
      targetType: input.targetType,
      targetId: booking.id,
      dedupeKey,
      bookingId: booking.id,
      personId: booking.personId ?? null,
      organizationId: booking.organizationId ?? null,
      paymentSessionId: input.paymentSessionId ?? null,
      notificationDeliveryId: null,
      status: "processing",
      recipient: recipient?.email ?? null,
      scheduledFor: now,
      processedAt: now,
      errorMessage: null,
      metadata: {
        eventTargetType: input.targetType,
        bookingNumber: booking.bookingNumber,
        ...(input.eventData ?? {}),
      },
    })
    .onConflictDoNothing({ target: notificationReminderRuns.dedupeKey })
    .returning()

  if (!processingRun) {
    return null
  }

  if (!recipient?.email) {
    return markReminderRunSkipped(
      db,
      processingRun.id,
      now,
      "No traveler email available for booking notification event",
    )
  }

  try {
    const delivery = await sendNotification(db, dispatcher, {
      templateId: rule.templateId ?? null,
      templateSlug: rule.templateSlug ?? null,
      channel: rule.channel,
      provider: rule.provider ?? null,
      to: recipient.email,
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        trigger: input.targetType,
        event: input.eventData ?? {},
        traveler: {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          participantType: recipient.participantType,
          isPrimary: recipient.isPrimary,
        },
        travelers: participants,
        booking: {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          status: booking.status,
          startDate: booking.startDate,
          endDate: booking.endDate,
          sellCurrency: booking.sellCurrency,
          sellAmountCents: booking.sellAmountCents,
        },
        ...serializeBookingPaymentContext(paymentContext),
        payment:
          input.targetType === "payment_complete"
            ? {
                isPaidInFull: true,
                paymentSessionId: input.paymentSessionId ?? null,
              }
            : null,
        documents: documentContext.documents,
        items,
      },
      attachments: documentContext.attachments.length > 0 ? documentContext.attachments : null,
      targetType: input.targetType === "payment_complete" ? "payment_session" : "booking",
      targetId:
        input.targetType === "payment_complete"
          ? (input.paymentSessionId ?? booking.id)
          : booking.id,
      bookingId: booking.id,
      paymentSessionId: input.paymentSessionId ?? null,
      personId: booking.personId ?? null,
      organizationId: booking.organizationId ?? null,
      metadata: {
        reminderRuleId: rule.id,
        reminderRunId: processingRun.id,
        eventTargetType: input.targetType,
        bookingDocumentKeys: documentContext.documents.map((document) => document.key),
      },
      scheduledFor: now.toISOString(),
    })

    return markReminderRunSent(db, processingRun.id, new Date(), delivery?.id ?? null)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification event delivery failed"
    return markReminderRunFailed(db, processingRun.id, new Date(), message)
  }
}

export async function dispatchReminderEventRules(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  input: {
    targetType: BookingEventReminderTargetType
    bookingId: string
    paymentSessionId?: string | null
    eventData?: Record<string, unknown>
  },
  runtime: BookingEventReminderRuntimeOptions = {},
) {
  const rules = await db
    .select()
    .from(notificationReminderRules)
    .where(
      and(
        eq(notificationReminderRules.status, "active"),
        eq(notificationReminderRules.targetType, input.targetType),
      ),
    )
    .orderBy(notificationReminderRules.createdAt)

  const results = []
  for (const rule of rules) {
    results.push(await sendBookingEventReminder(db, dispatcher, rule, input, runtime))
  }

  return results
}

export async function bookingIsPaidInFullForNotification(
  db: PostgresJsDatabase,
  bookingId: string,
) {
  return !(await hasOutstandingBookingBalance(db, bookingId))
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
        or(
          eq(notificationReminderRuns.status, "queued"),
          eq(notificationReminderRuns.status, "failed"),
        ),
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

  try {
    if (run.targetType === "booking_payment_schedule") {
      return await sendQueuedBookingPaymentScheduleReminder(db, dispatcher, run, rule, now)
    }

    if (run.targetType === "invoice") {
      return await sendQueuedInvoiceReminder(db, dispatcher, run, rule, now)
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

function buildStageDedupeKey(
  ruleId: string,
  targetId: string,
  runDate: string,
  stageId: string,
  channel: string,
) {
  return `${ruleId}:${targetId}:${runDate}:${stageId}:${channel}`
}

async function fetchScheduleRow(db: PostgresJsDatabase, scheduleId: string) {
  const [row] = await db
    .select()
    .from(bookingPaymentSchedules)
    .where(eq(bookingPaymentSchedules.id, scheduleId))
    .limit(1)
  return row ?? null
}

async function fetchInvoiceRow(db: PostgresJsDatabase, invoiceId: string) {
  const [row] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  return row ?? null
}

async function emitStageChannelRun(
  db: PostgresJsDatabase,
  dispatcher: NotificationService | null,
  rule: NotificationReminderRuleRow,
  stage: NotificationReminderRuleStage,
  channelRow: NotificationReminderStageChannel,
  target: ReminderTargetSnapshot,
  recipient: { email: string | null; firstName?: string; lastName?: string } | null,
  scheduledAt: Date,
  sendCountAtFire: number,
  enqueueDelivery: ReminderDeliveryEnqueuer | null,
  now: Date,
): Promise<{
  status: "queued" | "sent" | "skipped" | "failed"
  runId: string | null
}> {
  const runDate = toDateString(startOfUtcDay(scheduledAt))
  const dedupeKey = buildStageDedupeKey(rule.id, target.id, runDate, stage.id, channelRow.channel)

  const [existingRun] = await db
    .select()
    .from(notificationReminderRuns)
    .where(eq(notificationReminderRuns.dedupeKey, dedupeKey))
    .limit(1)
  if (existingRun && existingRun.status !== "failed") {
    return { status: "skipped", runId: existingRun.id }
  }

  const baseValues = {
    reminderRuleId: rule.id,
    targetType: rule.targetType,
    targetId: target.id,
    dedupeKey,
    bookingId: target.bookingId,
    personId: null as string | null,
    organizationId: null as string | null,
    paymentSessionId: null as string | null,
    notificationDeliveryId: null as string | null,
    recipient: recipient?.email ?? null,
    scheduledFor: scheduledAt,
    processedAt: now,
    errorMessage: null,
    metadata: {
      stageId: stage.id,
      stageOrderIndex: stage.orderIndex,
      stageChannelId: channelRow.id,
      channel: channelRow.channel,
      anchor: stage.anchor,
      sendCountAtFire,
      ruleSlug: rule.slug,
    } as Record<string, unknown>,
  }

  if (!recipient?.email) {
    const [run] = existingRun
      ? await db
          .update(notificationReminderRuns)
          .set({ ...baseValues, status: "skipped", errorMessage: "no_recipient" })
          .where(eq(notificationReminderRuns.id, existingRun.id))
          .returning()
      : await db
          .insert(notificationReminderRuns)
          .values({ ...baseValues, status: "skipped", errorMessage: "no_recipient" })
          .onConflictDoNothing({ target: notificationReminderRuns.dedupeKey })
          .returning()
    return { status: "skipped", runId: run?.id ?? null }
  }

  if (enqueueDelivery && !dispatcher) {
    const [queuedRun] = existingRun
      ? await db
          .update(notificationReminderRuns)
          .set({ ...baseValues, status: "queued" })
          .where(eq(notificationReminderRuns.id, existingRun.id))
          .returning()
      : await db
          .insert(notificationReminderRuns)
          .values({ ...baseValues, status: "queued" })
          .onConflictDoNothing({ target: notificationReminderRuns.dedupeKey })
          .returning()
    if (!queuedRun) return { status: "skipped", runId: null }
    try {
      await enqueueDelivery({ reminderRunId: queuedRun.id })
      return { status: "queued", runId: queuedRun.id }
    } catch (error) {
      const message = error instanceof Error ? error.message : "enqueue_failed"
      const failed = await markReminderRunFailed(db, queuedRun.id, new Date(), message)
      return { status: "failed", runId: failed?.id ?? null }
    }
  }

  if (!dispatcher) {
    return { status: "skipped", runId: null }
  }

  const [processingRun] = existingRun
    ? await db
        .update(notificationReminderRuns)
        .set({ ...baseValues, status: "processing" })
        .where(eq(notificationReminderRuns.id, existingRun.id))
        .returning()
    : await db
        .insert(notificationReminderRuns)
        .values({ ...baseValues, status: "processing" })
        .onConflictDoNothing({ target: notificationReminderRuns.dedupeKey })
        .returning()

  if (!processingRun) {
    return { status: "skipped", runId: null }
  }

  try {
    const data: Record<string, unknown> = {
      reminderRuleId: rule.id,
      reminderRunId: processingRun.id,
      stageId: stage.id,
      stageOrderIndex: stage.orderIndex,
      sendCountAtFire,
    }
    let delivery: { id: string } | null = null
    if (rule.targetType === "invoice") {
      const invoice = await fetchInvoiceRow(db, target.id)
      if (!invoice) {
        return {
          status: "skipped",
          runId:
            (await markReminderRunSkipped(db, processingRun.id, new Date(), "invoice_not_found"))
              ?.id ?? null,
        }
      }
      delivery = await sendInvoiceNotification(db, dispatcher, invoice.id, {
        templateId: channelRow.templateId ?? null,
        templateSlug: channelRow.templateSlug ?? null,
        channel: channelRow.channel,
        provider: channelRow.provider ?? null,
        to: recipient.email,
        data,
        metadata: { reminderRuleId: rule.id, reminderRunId: processingRun.id, stageId: stage.id },
        scheduledFor: scheduledAt.toISOString(),
      })
    } else if (rule.targetType === "booking_payment_schedule") {
      const schedule = await fetchScheduleRow(db, target.id)
      if (!schedule) {
        return {
          status: "skipped",
          runId:
            (await markReminderRunSkipped(db, processingRun.id, new Date(), "schedule_not_found"))
              ?.id ?? null,
        }
      }
      delivery = await sendNotification(db, dispatcher, {
        templateId: channelRow.templateId ?? null,
        templateSlug: channelRow.templateSlug ?? null,
        channel: channelRow.channel,
        provider: channelRow.provider ?? null,
        to: recipient.email,
        data: {
          ...data,
          bookingId: schedule.bookingId,
          dueDate: schedule.dueDate,
          amountCents: schedule.amountCents,
          currency: schedule.currency,
        },
        targetType: "booking_payment_schedule",
        targetId: schedule.id,
        bookingId: schedule.bookingId,
        metadata: { reminderRuleId: rule.id, reminderRunId: processingRun.id, stageId: stage.id },
        scheduledFor: scheduledAt.toISOString(),
      })
    } else {
      return {
        status: "skipped",
        runId:
          (
            await markReminderRunSkipped(
              db,
              processingRun.id,
              new Date(),
              "unsupported_target_type",
            )
          )?.id ?? null,
      }
    }

    const sent = await markReminderRunSent(db, processingRun.id, new Date(), delivery?.id ?? null)
    return { status: "sent", runId: sent?.id ?? null }
  } catch (error) {
    const message = error instanceof Error ? error.message : "delivery_failed"
    const failed = await markReminderRunFailed(db, processingRun.id, new Date(), message)
    return { status: "failed", runId: failed?.id ?? null }
  }
}

async function processStageRuleTargets(
  db: PostgresJsDatabase,
  options: {
    rule: NotificationReminderRuleRow
    stages: NotificationReminderRuleStage[]
    targets: ReminderTargetSnapshot[]
    settings: NotificationSettings
    today: Date
    now: Date
    dispatcher: NotificationService | null
    enqueueDelivery: ReminderDeliveryEnqueuer | null
  },
): Promise<{ processed: number; sent: number; queued: number; skipped: number; failed: number }> {
  const tally = { processed: 0, sent: 0, queued: 0, skipped: 0, failed: 0 }
  for (const target of options.targets) {
    const history = await loadHistory(db, options.rule.id, target.id)
    const decision = evaluateStage(options.rule, options.stages, target, history, options.today)
    if (!decision.fire) continue

    const channels = await listChannelsForStage(db, decision.stage.id)
    if (channels.length === 0) continue

    const booking = target.bookingId
      ? ((
          await db
            .select({
              id: bookings.id,
              bookingNumber: bookings.bookingNumber,
              personId: bookings.personId,
              organizationId: bookings.organizationId,
              contactFirstName: bookings.contactFirstName,
              contactLastName: bookings.contactLastName,
              contactEmail: bookings.contactEmail,
              contactPhone: bookings.contactPhone,
              contactPreferredLanguage: bookings.contactPreferredLanguage,
            })
            .from(bookings)
            .where(eq(bookings.id, target.bookingId))
            .limit(1)
        )[0] ?? null)
      : null
    const participants = booking
      ? await db
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
          .orderBy(desc(bookingTravelers.isPrimary), bookingTravelers.createdAt)
      : []
    const recipient = booking ? resolveReminderRecipient(booking, participants) : null

    if (
      await suppressedByGroup(
        db,
        recipient?.email ?? null,
        options.rule.suppressionGroup,
        options.settings,
        options.now,
      )
    ) {
      tally.skipped += 1
      continue
    }

    const { scheduledAt } = applyQuietHours(options.now, decision.stage, options.settings)

    for (const channelRow of channels) {
      if (
        recipient?.email &&
        (await exceedsRecipientRateLimit(
          db,
          recipient.email,
          channelRow.channel,
          options.settings,
          options.now,
        ))
      ) {
        tally.skipped += 1
        continue
      }
      const result = await emitStageChannelRun(
        db,
        options.dispatcher,
        options.rule,
        decision.stage,
        channelRow,
        target,
        recipient ?? null,
        scheduledAt,
        decision.sendCountAtFire,
        options.enqueueDelivery,
        options.now,
      )
      tally.processed += 1
      if (result.status === "sent") tally.sent += 1
      if (result.status === "queued") tally.queued += 1
      if (result.status === "skipped") tally.skipped += 1
      if (result.status === "failed") tally.failed += 1
    }
  }
  return tally
}

export async function runStageBasedDueReminders(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  input: RunDueRemindersInput = {},
): Promise<ReminderSweepResult> {
  const now = toTimestamp(input.now) ?? new Date()
  const today = startOfUtcDay(now)
  const settings = await getNotificationSettings(db)
  const rules = await listActiveRulesByPriority(db)
  const summary = buildReminderSweepSummary()

  for (const rule of rules) {
    const stages = await listStagesForRule(db, rule.id)
    if (stages.length === 0) continue
    const targets = await fetchTargetsForRule(db, rule)
    if (targets.length === 0) continue
    const tally = await processStageRuleTargets(db, {
      rule,
      stages,
      targets,
      settings,
      today,
      now,
      dispatcher,
      enqueueDelivery: null,
    })
    summary.processed += tally.processed
    summary.sent += tally.sent
    summary.skipped += tally.skipped
    summary.failed += tally.failed
  }

  return summary
}

export async function queueStageBasedDueReminders(
  db: PostgresJsDatabase,
  enqueueDelivery: ReminderDeliveryEnqueuer,
  input: RunDueRemindersInput = {},
): Promise<ReminderQueueResult> {
  const now = toTimestamp(input.now) ?? new Date()
  const today = startOfUtcDay(now)
  const settings = await getNotificationSettings(db)
  const rules = await listActiveRulesByPriority(db)
  const summary = buildReminderQueueSummary()

  for (const rule of rules) {
    const stages = await listStagesForRule(db, rule.id)
    if (stages.length === 0) continue
    const targets = await fetchTargetsForRule(db, rule)
    if (targets.length === 0) continue
    const tally = await processStageRuleTargets(db, {
      rule,
      stages,
      targets,
      settings,
      today,
      now,
      dispatcher: null,
      enqueueDelivery,
    })
    summary.processed += tally.processed
    summary.queued += tally.queued
    summary.skipped += tally.skipped
    summary.failed += tally.failed
  }

  return summary
}
