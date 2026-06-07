import { bookingItems, bookingTravelers } from "@voyantjs/bookings/schema"
import type { bookingPaymentSchedules } from "@voyantjs/finance"
import { and, desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { SQLWrapper } from "drizzle-orm/sql"
import type { z } from "zod"

import { renderLiquidTemplate } from "./liquid.js"
import type { notificationReminderRules } from "./schema.js"
import type {
  NotificationAttachment,
  NotificationChannel,
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from "./types.js"
import type {
  bookingDocumentBundleItemSchema,
  insertNotificationReminderRuleSchema,
  insertNotificationTemplateSchema,
  notificationDeliveryListQuerySchema,
  notificationReminderRuleListQuerySchema,
  notificationReminderRunListQuerySchema,
  notificationReminderRunRecordSchema,
  notificationTemplateListQuerySchema,
  previewNotificationTemplateSchema,
  runDueRemindersSchema,
  sendBookingDocumentsNotificationSchema,
  sendInvoiceNotificationSchema,
  sendNotificationSchema,
  sendPaymentSessionNotificationSchema,
  updateNotificationReminderRuleSchema,
  updateNotificationTemplateSchema,
} from "./validation.js"

export type NotificationTemplateListQuery = z.infer<typeof notificationTemplateListQuerySchema>
export type NotificationDeliveryListQuery = z.infer<typeof notificationDeliveryListQuerySchema>
export type CreateNotificationTemplateInput = z.infer<typeof insertNotificationTemplateSchema>
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>
export type NotificationReminderRuleListQuery = z.infer<
  typeof notificationReminderRuleListQuerySchema
>
export type NotificationReminderRunListQuery = z.infer<
  typeof notificationReminderRunListQuerySchema
>
export type NotificationReminderRunRecord = z.infer<typeof notificationReminderRunRecordSchema>
export type CreateNotificationReminderRuleInput = z.infer<
  typeof insertNotificationReminderRuleSchema
>
export type UpdateNotificationReminderRuleInput = z.infer<
  typeof updateNotificationReminderRuleSchema
>
export type RunDueRemindersInput = z.infer<typeof runDueRemindersSchema>
export type PreviewNotificationTemplateInput = z.infer<typeof previewNotificationTemplateSchema>
export type SendPaymentSessionNotificationInput = z.infer<
  typeof sendPaymentSessionNotificationSchema
>
export type SendInvoiceNotificationInput = z.infer<typeof sendInvoiceNotificationSchema>
export type SendBookingDocumentsNotificationInput = z.infer<
  typeof sendBookingDocumentsNotificationSchema
>
export type BookingDocumentBundleItem = z.infer<typeof bookingDocumentBundleItemSchema>

export type ReminderSweepResult = {
  processed: number
  sent: number
  skipped: number
  failed: number
}

export type ReminderQueueResult = {
  processed: number
  queued: number
  skipped: number
  failed: number
}

export type NotificationReminderRuleRow = typeof notificationReminderRules.$inferSelect
export type BookingPaymentScheduleRow = typeof bookingPaymentSchedules.$inferSelect

export class NotificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotificationError"
  }
}

export interface NotificationService {
  send(payload: NotificationPayload): Promise<NotificationResult>
  sendWith(providerName: string, payload: NotificationPayload): Promise<NotificationResult>
  getProvider(channel: NotificationChannel): NotificationProvider | undefined
  getProviderByName?(providerName: string): NotificationProvider | undefined
}

export function createNotificationService(
  providers: ReadonlyArray<NotificationProvider>,
): NotificationService {
  const byChannel = new Map<NotificationChannel, NotificationProvider>()
  const byName = new Map<string, NotificationProvider>()
  for (const provider of providers) {
    byName.set(provider.name, provider)
    for (const channel of provider.channels) {
      byChannel.set(channel, provider)
    }
  }

  return {
    async send(payload) {
      const hintedProvider = payload.provider ? byName.get(payload.provider) : null
      const provider = hintedProvider ?? byChannel.get(payload.channel)
      if (!provider) {
        throw new NotificationError(
          `No notification provider registered for channel "${payload.channel}"`,
        )
      }
      return provider.send(payload)
    },
    async sendWith(providerName, payload) {
      const provider = byName.get(providerName)
      if (!provider) {
        throw new NotificationError(
          `No notification provider registered with name "${providerName}"`,
        )
      }
      return provider.send(payload)
    },
    getProvider(channel) {
      return byChannel.get(channel)
    },
    getProviderByName(providerName) {
      return byName.get(providerName)
    },
  }
}

export function summarizeNotificationAttachments(
  attachments: ReadonlyArray<NotificationAttachment> | null | undefined,
) {
  if (!attachments || attachments.length === 0) {
    return []
  }

  return attachments.map((attachment) => ({
    filename: attachment.filename,
    path: attachment.path ?? null,
    contentType: attachment.contentType ?? null,
    disposition: attachment.disposition ?? null,
    contentId: attachment.contentId ?? null,
  }))
}

export function renderNotificationTemplate(
  template: string | null | undefined,
  data: Record<string, unknown>,
) {
  return renderLiquidTemplate(template, normalizeNotificationTemplateData(data))
}

export function previewNotificationTemplate(input: PreviewNotificationTemplateInput) {
  const data = normalizeNotificationTemplateData(input.data ?? {})
  return {
    channel: input.channel,
    provider: input.provider ?? null,
    fromAddress: input.fromAddress ?? null,
    subject: renderNotificationTemplate(input.subjectTemplate, data),
    html: renderNotificationTemplate(input.htmlTemplate, data),
    text: renderNotificationTemplate(input.textTemplate, data),
  }
}

export function toTimestamp(value?: string | null) {
  return value ? new Date(value) : null
}

function centsToAmount(value: unknown) {
  if (typeof value !== "number") return null
  return value / 100
}

function buildFullName(firstName: unknown, lastName: unknown) {
  return [firstName, lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ")
}

function parseDate(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function dateDiffInDays(from: Date, to: Date) {
  const diff = to.getTime() - from.getTime()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

function enrichTraveler(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const traveler = value as Record<string, unknown>
  const fullName = buildFullName(traveler.firstName, traveler.lastName)
  return {
    ...traveler,
    fullName: fullName || null,
    name: fullName || null,
    role: traveler.participantType ?? null,
  }
}

function enrichBooking(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const booking = value as Record<string, unknown>
  const bookingNumber =
    typeof booking.bookingNumber === "string"
      ? booking.bookingNumber
      : typeof booking.reference === "string"
        ? booking.reference
        : typeof booking.code === "string"
          ? booking.code
          : typeof booking.number === "string"
            ? booking.number
            : null
  const currency =
    typeof booking.currency === "string"
      ? booking.currency
      : typeof booking.sellCurrency === "string"
        ? booking.sellCurrency
        : null
  const totalAmount =
    centsToAmount(booking.totalAmountCents) ??
    centsToAmount(booking.sellAmountCents) ??
    (typeof booking.totalAmount === "number" ? booking.totalAmount : null)
  const startDate = parseDate(booking.startDate)
  const endDate = parseDate(booking.endDate)
  const dateRange =
    startDate && endDate
      ? `${startDate.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)}`
      : null

  return {
    ...booking,
    code: bookingNumber,
    number: bookingNumber,
    reference: bookingNumber,
    currency,
    total: totalAmount,
    totalAmount,
    totalPrice: totalAmount,
    dateRange,
  }
}

function enrichInvoice(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const invoice = value as Record<string, unknown>
  return {
    ...invoice,
    number:
      typeof invoice.number === "string"
        ? invoice.number
        : typeof invoice.invoiceNumber === "string"
          ? invoice.invoiceNumber
          : null,
    type:
      typeof invoice.type === "string"
        ? invoice.type
        : typeof invoice.invoiceType === "string"
          ? invoice.invoiceType
          : null,
    subtotalAmount:
      centsToAmount(invoice.subtotalCents) ??
      (typeof invoice.subtotalAmount === "number" ? invoice.subtotalAmount : null),
    taxAmount:
      centsToAmount(invoice.taxCents) ??
      (typeof invoice.taxAmount === "number" ? invoice.taxAmount : null),
    totalAmount:
      centsToAmount(invoice.totalCents) ??
      (typeof invoice.totalAmount === "number" ? invoice.totalAmount : null),
    paidAmount:
      centsToAmount(invoice.paidCents) ??
      (typeof invoice.paidAmount === "number" ? invoice.paidAmount : null),
    balanceDueAmount:
      centsToAmount(invoice.balanceDueCents) ??
      (typeof invoice.balanceDueAmount === "number" ? invoice.balanceDueAmount : null),
  }
}

function enrichPaymentSession(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const session = value as Record<string, unknown>
  return {
    ...session,
    amount:
      centsToAmount(session.amountCents) ??
      (typeof session.amount === "number" ? session.amount : null),
    paymentUrl:
      typeof session.paymentUrl === "string"
        ? session.paymentUrl
        : typeof session.redirectUrl === "string"
          ? session.redirectUrl
          : null,
    reference:
      typeof session.reference === "string"
        ? session.reference
        : typeof session.externalReference === "string"
          ? session.externalReference
          : null,
    method:
      typeof session.method === "string"
        ? session.method
        : typeof session.paymentMethod === "string"
          ? session.paymentMethod
          : null,
    isPaid:
      session.status === "paid" ||
      session.status === "completed" ||
      session.status === "succeeded" ||
      Boolean(session.completedAt),
  }
}

function enrichPaymentSchedule(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const schedule = value as Record<string, unknown>
  const dueDate = parseDate(schedule.dueDate)
  const today = new Date()
  return {
    ...schedule,
    amountDue:
      centsToAmount(schedule.amountCents) ??
      (typeof schedule.amountDue === "number" ? schedule.amountDue : null),
    type:
      typeof schedule.type === "string"
        ? schedule.type
        : typeof schedule.scheduleType === "string"
          ? schedule.scheduleType
          : null,
    daysLeft: dueDate ? dateDiffInDays(today, dueDate) : null,
  }
}

function enrichDocument(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  return value
}

function enrichBookingItem(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const item = value as Record<string, unknown>
  return {
    ...item,
    description:
      typeof item.description === "string" && item.description.trim().length > 0
        ? item.description
        : typeof item.title === "string"
          ? item.title
          : null,
    currency:
      typeof item.currency === "string"
        ? item.currency
        : typeof item.sellCurrency === "string"
          ? item.sellCurrency
          : null,
    unitPrice:
      centsToAmount(item.unitSellAmountCents) ??
      (typeof item.unitPrice === "number" ? item.unitPrice : null),
    total:
      centsToAmount(item.totalSellAmountCents) ??
      (typeof item.total === "number" ? item.total : null),
  }
}

export function normalizeNotificationTemplateData(data: Record<string, unknown>) {
  const traveler = enrichTraveler(data.traveler)
  const travelers = Array.isArray(data.travelers)
    ? data.travelers.map((entry) => enrichTraveler(entry))
    : traveler
      ? [traveler]
      : []
  const booking = enrichBooking(data.booking)
  const invoice = enrichInvoice(data.invoice)
  const paymentSession = enrichPaymentSession(data.paymentSession)
  const paymentSchedule = enrichPaymentSchedule(data.paymentSchedule)
  const suppliedPayment =
    data.payment && typeof data.payment === "object" && !Array.isArray(data.payment)
      ? (data.payment as Record<string, unknown>)
      : null
  const documents = Array.isArray(data.documents)
    ? data.documents.map((document) => enrichDocument(document))
    : []
  const items = Array.isArray(data.items) ? data.items.map((item) => enrichBookingItem(item)) : []

  const derivedPayment =
    paymentSchedule && typeof paymentSchedule === "object"
      ? {
          amount: (paymentSchedule as Record<string, unknown>).amountDue ?? null,
          currency:
            (paymentSchedule as Record<string, unknown>).currency ??
            (invoice as Record<string, unknown> | null)?.currency ??
            (paymentSession as Record<string, unknown> | null)?.currency ??
            (booking as Record<string, unknown> | null)?.currency ??
            null,
          dueDate: (paymentSchedule as Record<string, unknown>).dueDate ?? null,
          daysLeft: (paymentSchedule as Record<string, unknown>).daysLeft ?? null,
          reference:
            (booking as Record<string, unknown> | null)?.reference ??
            (invoice as Record<string, unknown> | null)?.number ??
            null,
          method:
            (paymentSession as Record<string, unknown> | null)?.method ??
            (paymentSession as Record<string, unknown> | null)?.provider ??
            null,
          link: (paymentSession as Record<string, unknown> | null)?.paymentUrl ?? null,
          payMode: (paymentSchedule as Record<string, unknown>).type ?? null,
          paidAmount:
            (invoice as Record<string, unknown> | null)?.paidAmount ??
            ((paymentSession as Record<string, unknown> | null)?.isPaid
              ? (paymentSession as Record<string, unknown>).amount
              : null),
          balanceDue:
            (invoice as Record<string, unknown> | null)?.balanceDueAmount ??
            (paymentSchedule as Record<string, unknown>).amountDue ??
            null,
          isPaidInFull:
            ((invoice as Record<string, unknown> | null)?.balanceDueAmount as number | null) === 0,
        }
      : paymentSession && typeof paymentSession === "object"
        ? {
            amount: (paymentSession as Record<string, unknown>).amount ?? null,
            currency: (paymentSession as Record<string, unknown>).currency ?? null,
            dueDate: null,
            daysLeft: null,
            reference: (paymentSession as Record<string, unknown>).reference ?? null,
            method: (paymentSession as Record<string, unknown>).method ?? null,
            link: (paymentSession as Record<string, unknown>).paymentUrl ?? null,
            payMode: null,
            paidAmount: null,
            balanceDue: (invoice as Record<string, unknown> | null)?.balanceDueAmount ?? null,
            isPaidInFull:
              ((invoice as Record<string, unknown> | null)?.balanceDueAmount as number | null) ===
              0,
          }
        : invoice && typeof invoice === "object"
          ? {
              amount: (invoice as Record<string, unknown>).balanceDueAmount ?? null,
              currency: (invoice as Record<string, unknown>).currency ?? null,
              dueDate: (invoice as Record<string, unknown>).dueDate ?? null,
              daysLeft: null,
              reference:
                (booking as Record<string, unknown> | null)?.reference ??
                (invoice as Record<string, unknown>).number ??
                null,
              method:
                (paymentSession as Record<string, unknown> | null)?.method ??
                (paymentSession as Record<string, unknown> | null)?.provider ??
                null,
              link: (paymentSession as Record<string, unknown> | null)?.paymentUrl ?? null,
              payMode: null,
              paidAmount: (invoice as Record<string, unknown>).paidAmount ?? null,
              balanceDue: (invoice as Record<string, unknown>).balanceDueAmount ?? null,
              isPaidInFull:
                ((invoice as Record<string, unknown>).balanceDueAmount as number | null) === 0,
            }
          : null
  const payment = derivedPayment
    ? {
        ...derivedPayment,
        ...suppliedPayment,
      }
    : suppliedPayment

  const product =
    items.length > 0 && items[0] && typeof items[0] === "object"
      ? {
          title:
            (items[0] as Record<string, unknown>).title ??
            (items[0] as Record<string, unknown>).description ??
            null,
        }
      : null

  return {
    ...data,
    traveler,
    travelers,
    billingPerson: traveler,
    billing: traveler,
    booking,
    invoice,
    paymentSession,
    paymentSchedule,
    payment,
    documents,
    documentsCount: documents.length,
    items,
    product,
  }
}

export function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

export function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000)
}

export function toDateString(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function buildReminderDedupeKey(ruleId: string, targetId: string, runDate: string) {
  return `${ruleId}:${targetId}:${runDate}`
}

export function resolveReminderRecipient(
  booking: {
    contactFirstName: string | null
    contactLastName: string | null
    contactEmail: string | null
    contactPhone: string | null
    contactPreferredLanguage: string | null
  } | null,
  participants: Array<{
    email: string | null
    isPrimary: boolean
    participantType: string
    firstName: string
    lastName: string
  }>,
) {
  if (booking?.contactEmail) {
    return {
      email: booking.contactEmail,
      firstName: booking.contactFirstName ?? "",
      lastName: booking.contactLastName ?? "",
      participantType: "booking_contact",
      isPrimary: true,
    }
  }

  const withEmail = participants.filter((traveler) => traveler.email)
  if (withEmail.length === 0) {
    return null
  }

  const nonStaffWithEmail = withEmail.filter((traveler) => traveler.participantType !== "staff")
  const primary =
    nonStaffWithEmail.find((traveler) => traveler.isPrimary) ??
    withEmail.find((traveler) => traveler.isPrimary)
  if (primary) {
    return primary
  }

  const preferredTypes = ["traveler", "occupant", "other"]
  for (const type of preferredTypes) {
    const match = nonStaffWithEmail.find((traveler) => traveler.participantType === type)
    if (match) {
      return match
    }
  }

  return nonStaffWithEmail[0] ?? withEmail[0] ?? null
}

export async function listBookingNotificationParticipants(
  db: PostgresJsDatabase,
  bookingId: string,
) {
  return db
    .select({
      id: bookingTravelers.id,
      firstName: bookingTravelers.firstName,
      lastName: bookingTravelers.lastName,
      email: bookingTravelers.email,
      participantType: bookingTravelers.participantType,
      isPrimary: bookingTravelers.isPrimary,
    })
    .from(bookingTravelers)
    .where(eq(bookingTravelers.bookingId, bookingId))
    .orderBy(desc(bookingTravelers.isPrimary), bookingTravelers.createdAt)
}

export async function listBookingNotificationItems(db: PostgresJsDatabase, bookingId: string) {
  const rows = await db
    .select({
      id: bookingItems.id,
      title: bookingItems.title,
      description: bookingItems.description,
      quantity: bookingItems.quantity,
      itemType: bookingItems.itemType,
      serviceDate: bookingItems.serviceDate,
      sellCurrency: bookingItems.sellCurrency,
      unitSellAmountCents: bookingItems.unitSellAmountCents,
      totalSellAmountCents: bookingItems.totalSellAmountCents,
    })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))
    .orderBy(bookingItems.createdAt)

  return rows.map((row) => enrichBookingItem(row))
}

export async function paginate<T>(
  rowsPromise: Promise<T[]>,
  totalPromise: Promise<Array<{ total: number }>>,
  limit: number,
  offset: number,
) {
  const [data, totalRows] = await Promise.all([rowsPromise, totalPromise])
  return {
    data,
    total: totalRows[0]?.total ?? 0,
    limit,
    offset,
  }
}

export function buildWhereClause<T extends SQLWrapper>(conditions: Array<T | undefined>) {
  const filtered = conditions.filter((condition): condition is T => Boolean(condition))
  return filtered.length > 0 ? and(...filtered) : undefined
}
