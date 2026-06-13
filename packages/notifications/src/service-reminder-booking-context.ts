import { bookings } from "@voyantjs/bookings/schema"
import { bookingPaymentSchedules, invoices, paymentSessions } from "@voyantjs/finance"
import { and, asc, desc, eq, gt, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type BookingDocumentAttachmentResolver,
  bookingDocumentNotificationsService,
  createDefaultBookingDocumentAttachment,
} from "./service-booking-documents.js"
import type { BookingDocumentBundleItem, BookingPaymentScheduleRow } from "./service-shared.js"
import type { NotificationAttachment } from "./types.js"

export const PAYABLE_BOOKING_STATUSES = new Set([
  "on_hold",
  "awaiting_payment",
  "confirmed",
  "in_progress",
])
export const OPEN_PAYMENT_SCHEDULE_STATUSES = new Set(["pending", "due"])

export interface BookingEventReminderRuntimeOptions {
  documentAttachmentResolver?: BookingDocumentAttachmentResolver
}

export function paymentScheduleStatusSkipReason(status: string) {
  return `payment_schedule_status_${status}`
}

export function bookingStatusSkipReason(status: string) {
  return `booking_status_${status}`
}

export async function getPaymentReminderBookingStatusSkipReason(
  db: PostgresJsDatabase,
  bookingId: string,
) {
  const [booking] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)

  if (!booking) {
    return "booking_not_found"
  }

  return PAYABLE_BOOKING_STATUSES.has(booking.status)
    ? null
    : bookingStatusSkipReason(booking.status)
}

export async function getBookingPaymentNotificationContext(
  db: PostgresJsDatabase,
  bookingId: string,
) {
  const [[paymentSchedule], [invoice], [paymentSession]] = await Promise.all([
    db
      .select({
        id: bookingPaymentSchedules.id,
        bookingId: bookingPaymentSchedules.bookingId,
        scheduleType: bookingPaymentSchedules.scheduleType,
        status: bookingPaymentSchedules.status,
        dueDate: bookingPaymentSchedules.dueDate,
        currency: bookingPaymentSchedules.currency,
        amountCents: bookingPaymentSchedules.amountCents,
        createdAt: bookingPaymentSchedules.createdAt,
      })
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
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceType: invoices.invoiceType,
        status: invoices.status,
        currency: invoices.currency,
        subtotalCents: invoices.subtotalCents,
        taxCents: invoices.taxCents,
        totalCents: invoices.totalCents,
        paidCents: invoices.paidCents,
        balanceDueCents: invoices.balanceDueCents,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .orderBy(desc(invoices.createdAt))
      .limit(1),
    db
      .select({
        id: paymentSessions.id,
        status: paymentSessions.status,
        provider: paymentSessions.provider,
        currency: paymentSessions.currency,
        amountCents: paymentSessions.amountCents,
        redirectUrl: paymentSessions.redirectUrl,
        returnUrl: paymentSessions.returnUrl,
        cancelUrl: paymentSessions.cancelUrl,
        expiresAt: paymentSessions.expiresAt,
        paymentMethod: paymentSessions.paymentMethod,
        externalReference: paymentSessions.externalReference,
      })
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

export async function getBookingEventDocumentContext(
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

export function serializeBookingPaymentContext(
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

export async function hasOutstandingBookingBalance(db: PostgresJsDatabase, bookingId: string) {
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
          eq(invoices.status, "issued"),
          eq(invoices.status, "partially_paid"),
          eq(invoices.status, "overdue"),
        ),
      ),
    )
    .limit(1)

  return Boolean(openInvoice)
}
