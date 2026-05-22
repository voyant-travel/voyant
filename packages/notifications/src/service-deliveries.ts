import { bookings } from "@voyantjs/bookings/schema"
import { invoices, paymentSessions } from "@voyantjs/finance"
import { buildPaymentLinkUrl } from "@voyantjs/finance/payment-link"
import { desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { notificationDeliveries } from "./schema.js"
import type {
  NotificationDeliveryListQuery,
  NotificationService,
  SendInvoiceNotificationInput,
  SendNotificationInput,
  SendPaymentSessionNotificationInput,
} from "./service-shared.js"
import {
  buildWhereClause,
  listBookingNotificationItems,
  listBookingNotificationParticipants,
  NotificationError,
  paginate,
  renderNotificationTemplate,
  resolveReminderRecipient,
  summarizeNotificationAttachments,
  toTimestamp,
} from "./service-shared.js"
import { getTemplateById, getTemplateBySlug } from "./service-templates.js"
import type { NotificationAttachment } from "./types.js"

function normalizeAttachments(
  attachments:
    | Array<{
        filename: string
        contentBase64?: string | null
        path?: string | null
        contentType?: string | null
        disposition?: "attachment" | "inline" | null
        contentId?: string | null
      }>
    | null
    | undefined,
): NotificationAttachment[] | undefined {
  if (!attachments || attachments.length === 0) {
    return undefined
  }

  return attachments.map((attachment) => ({
    filename: attachment.filename,
    ...(attachment.contentBase64 ? { contentBase64: attachment.contentBase64 } : {}),
    ...(attachment.path ? { path: attachment.path } : {}),
    ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
    ...(attachment.disposition ? { disposition: attachment.disposition } : {}),
    ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
  }))
}

function truncateLogValue(value: string, maxLength = 4000) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…`
}

function readErrorField(error: unknown, field: string) {
  if (!error || typeof error !== "object" || !(field in error)) return null
  const value = (error as Record<string, unknown>)[field]
  if (typeof value === "string") return truncateLogValue(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (value == null) return null
  try {
    return truncateLogValue(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function serializeNotificationError(error: unknown) {
  const base =
    error instanceof Error
      ? {
          name: error.name,
          message: truncateLogValue(error.message),
          stack: error.stack ? truncateLogValue(error.stack) : null,
          cause:
            error.cause instanceof Error
              ? {
                  name: error.cause.name,
                  message: truncateLogValue(error.cause.message),
                  stack: error.cause.stack ? truncateLogValue(error.cause.stack) : null,
                }
              : readErrorField(error, "cause"),
        }
      : {
          name: typeof error,
          message: truncateLogValue(String(error)),
          stack: null,
          cause: null,
        }

  return {
    ...base,
    code: readErrorField(error, "code"),
    status: readErrorField(error, "status"),
    statusCode: readErrorField(error, "statusCode"),
    responseStatus: readErrorField(error, "responseStatus"),
    responseBody: readErrorField(error, "responseBody") ?? readErrorField(error, "body"),
    data: readErrorField(error, "data"),
    notificationRequest: readErrorField(error, "notificationRequest"),
  }
}

export function resolveNotificationPaymentUrl(
  paymentSessionId: string,
  options: { paymentLinkBaseUrl?: string | null; redirectUrl?: string | null } = {},
) {
  if (options.paymentLinkBaseUrl?.trim()) {
    return buildPaymentLinkUrl(paymentSessionId, { baseUrl: options.paymentLinkBaseUrl })
  }

  return normalizeAbsolutePaymentUrl(options.redirectUrl)
}

function normalizeAbsolutePaymentUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}

function metadataWithoutFailureLog(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null
  const rest = { ...metadata }
  delete rest.failureLog
  return rest
}

function isAttachmentSummary(value: unknown): value is NotificationAttachment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.filename === "string" &&
    record.filename.length > 0 &&
    (typeof record.path === "string" || typeof record.contentBase64 === "string")
  )
}

function attachmentsFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const rawAttachments = metadata?.attachments
  if (!Array.isArray(rawAttachments)) return undefined
  const attachments = rawAttachments.filter(isAttachmentSummary).map((attachment) => ({
    filename: attachment.filename,
    ...(attachment.contentBase64 ? { contentBase64: attachment.contentBase64 } : {}),
    ...(attachment.path ? { path: attachment.path } : {}),
    ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
    ...(attachment.disposition ? { disposition: attachment.disposition } : {}),
    ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
  }))
  return attachments.length > 0 ? attachments : undefined
}

export async function listDeliveries(db: PostgresJsDatabase, query: NotificationDeliveryListQuery) {
  const conditions = []
  if (query.channel) conditions.push(eq(notificationDeliveries.channel, query.channel))
  if (query.provider) conditions.push(eq(notificationDeliveries.provider, query.provider))
  if (query.status) conditions.push(eq(notificationDeliveries.status, query.status))
  if (query.templateSlug)
    conditions.push(eq(notificationDeliveries.templateSlug, query.templateSlug))
  if (query.targetType) conditions.push(eq(notificationDeliveries.targetType, query.targetType))
  if (query.targetId) conditions.push(eq(notificationDeliveries.targetId, query.targetId))
  if (query.bookingId) conditions.push(eq(notificationDeliveries.bookingId, query.bookingId))
  if (query.invoiceId) conditions.push(eq(notificationDeliveries.invoiceId, query.invoiceId))
  if (query.paymentSessionId) {
    conditions.push(eq(notificationDeliveries.paymentSessionId, query.paymentSessionId))
  }
  if (query.personId) conditions.push(eq(notificationDeliveries.personId, query.personId))
  if (query.organizationId) {
    conditions.push(eq(notificationDeliveries.organizationId, query.organizationId))
  }

  const where = buildWhereClause(conditions)
  return paginate(
    db
      .select()
      .from(notificationDeliveries)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(notificationDeliveries.createdAt)),
    db.select({ total: sql<number>`count(*)::int` }).from(notificationDeliveries).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDeliveryById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.id, id))
    .limit(1)
  return row ?? null
}

export async function resendDelivery(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  id: string,
) {
  const original = await getDeliveryById(db, id)
  if (!original) return null

  const previousMetadata = metadataWithoutFailureLog(original.metadata)
  return sendNotification(db, dispatcher, {
    templateId: original.templateId,
    templateSlug: original.templateSlug,
    channel: original.channel,
    provider: original.provider,
    to: original.toAddress,
    from: original.fromAddress,
    subject: original.subject,
    html: original.htmlBody,
    text: original.textBody,
    attachments: attachmentsFromMetadata(original.metadata),
    data: original.payloadData,
    targetType: original.targetType,
    targetId: original.targetId,
    bookingId: original.bookingId,
    invoiceId: original.invoiceId,
    paymentSessionId: original.paymentSessionId,
    personId: original.personId,
    organizationId: original.organizationId,
    metadata: {
      ...(previousMetadata ?? {}),
      resendOfDeliveryId: original.id,
      previousStatus: original.status,
    },
    scheduledFor: null,
  })
}

export async function sendNotification(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  input: SendNotificationInput,
) {
  let template = null
  if (input.templateId) {
    template = await getTemplateById(db, input.templateId)
  } else if (input.templateSlug) {
    template = await getTemplateBySlug(db, input.templateSlug)
  }

  if ((input.templateId || input.templateSlug) && !template) {
    throw new NotificationError("Notification template not found")
  }

  const data = input.data ?? {}
  const channel = input.channel ?? template?.channel
  if (!channel) {
    throw new NotificationError("Notification channel is required")
  }

  const provider = input.provider ?? template?.provider ?? dispatcher.getProvider(channel)?.name
  if (!provider) {
    throw new NotificationError(`No notification provider available for channel "${channel}"`)
  }

  const subject = input.subject ?? renderNotificationTemplate(template?.subjectTemplate, data)
  const html = input.html ?? renderNotificationTemplate(template?.htmlTemplate, data)
  const text = input.text ?? renderNotificationTemplate(template?.textTemplate, data)
  const attachments = normalizeAttachments(input.attachments)
  const attachmentSummary = summarizeNotificationAttachments(attachments)

  const [pending] = await db
    .insert(notificationDeliveries)
    .values({
      templateId: template?.id ?? null,
      templateSlug: template?.slug ?? input.templateSlug ?? null,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      personId: input.personId ?? null,
      organizationId: input.organizationId ?? null,
      bookingId: input.bookingId ?? null,
      invoiceId: input.invoiceId ?? null,
      paymentSessionId: input.paymentSessionId ?? null,
      channel,
      provider,
      providerMessageId: null,
      status: "pending",
      toAddress: input.to,
      fromAddress: input.from ?? template?.fromAddress ?? null,
      subject: subject ?? null,
      htmlBody: html ?? null,
      textBody: text ?? null,
      payloadData: data,
      metadata:
        (input.metadata ?? null) || attachmentSummary.length > 0
          ? {
              ...(input.metadata ?? {}),
              attachmentCount: attachmentSummary.length,
              attachments: attachmentSummary,
            }
          : null,
      errorMessage: null,
      scheduledFor: toTimestamp(input.scheduledFor),
      sentAt: null,
      failedAt: null,
    })
    .returning()

  if (!pending) {
    throw new NotificationError("Failed to create notification delivery")
  }

  try {
    const result =
      provider === dispatcher.getProvider(channel)?.name
        ? await dispatcher.send({
            to: input.to,
            channel,
            provider,
            template: template?.slug ?? input.templateSlug ?? "direct",
            data,
            from: input.from ?? template?.fromAddress ?? undefined,
            subject: subject ?? undefined,
            html: html ?? undefined,
            text: text ?? undefined,
            attachments,
          })
        : await dispatcher.sendWith(provider, {
            to: input.to,
            channel,
            provider,
            template: template?.slug ?? input.templateSlug ?? "direct",
            data,
            from: input.from ?? template?.fromAddress ?? undefined,
            subject: subject ?? undefined,
            html: html ?? undefined,
            text: text ?? undefined,
            attachments,
          })

    const [sent] = await db
      .update(notificationDeliveries)
      .set({
        status: "sent",
        providerMessageId: result.id ?? null,
        sentAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, pending.id))
      .returning()

    return sent ?? null
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification send failed"
    const failureLog = serializeNotificationError(error)
    const [failed] = await db
      .update(notificationDeliveries)
      .set({
        status: "failed",
        failedAt: new Date(),
        errorMessage: message,
        metadata: {
          ...(pending.metadata ?? {}),
          failureLog,
        },
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, pending.id))
      .returning()
    throw new NotificationError(failed?.errorMessage ?? message)
  }
}

export async function sendPaymentSessionNotification(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  sessionId: string,
  input: SendPaymentSessionNotificationInput,
) {
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, sessionId))
    .limit(1)
  if (!session) {
    return null
  }

  const booking = session.bookingId
    ? ((await db.select().from(bookings).where(eq(bookings.id, session.bookingId)).limit(1))[0] ??
      null)
    : null
  const invoice = session.invoiceId
    ? ((await db.select().from(invoices).where(eq(invoices.id, session.invoiceId)).limit(1))[0] ??
      null)
    : null

  const [participants, items] = booking
    ? await Promise.all([
        listBookingNotificationParticipants(db, booking.id),
        listBookingNotificationItems(db, booking.id),
      ])
    : [[], []]
  const recipient = resolveReminderRecipient(booking ?? null, participants)
  const to = input.to ?? session.payerEmail ?? recipient?.email ?? null

  if (!to) {
    throw new NotificationError("No recipient available for payment session notification")
  }

  return sendNotification(db, dispatcher, {
    templateId: input.templateId ?? null,
    templateSlug: input.templateSlug ?? null,
    channel: input.channel,
    provider: input.provider ?? null,
    to,
    from: input.from ?? null,
    subject: input.subject ?? null,
    html: input.html ?? null,
    text: input.text ?? null,
    data: {
      paymentSession: {
        id: session.id,
        status: session.status,
        provider: session.provider,
        currency: session.currency,
        amountCents: session.amountCents,
        paymentUrl: resolveNotificationPaymentUrl(session.id, {
          paymentLinkBaseUrl: input.paymentLinkBaseUrl,
          redirectUrl: session.redirectUrl,
        }),
        redirectUrl: session.redirectUrl,
        returnUrl: session.returnUrl,
        cancelUrl: session.cancelUrl,
        expiresAt: session.expiresAt,
        paymentMethod: session.paymentMethod,
        externalReference: session.externalReference,
      },
      booking: booking
        ? {
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            startDate: booking.startDate,
            endDate: booking.endDate,
            sellCurrency: booking.sellCurrency,
            sellAmountCents: booking.sellAmountCents,
          }
        : null,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceType: invoice.invoiceType,
            status: invoice.status,
            currency: invoice.currency,
            totalCents: invoice.totalCents,
            balanceDueCents: invoice.balanceDueCents,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
          }
        : null,
      traveler: recipient
        ? {
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            email: recipient.email,
            participantType: recipient.participantType,
            isPrimary: recipient.isPrimary,
          }
        : null,
      travelers: participants,
      items,
      ...(input.data ?? {}),
    },
    targetType: "payment_session",
    targetId: session.id,
    bookingId: session.bookingId ?? null,
    invoiceId: session.invoiceId ?? null,
    paymentSessionId: session.id,
    personId: session.payerPersonId ?? booking?.personId ?? null,
    organizationId: session.payerOrganizationId ?? booking?.organizationId ?? null,
    metadata: input.metadata ?? null,
    scheduledFor: input.scheduledFor ?? null,
  })
}

export async function sendInvoiceNotification(
  db: PostgresJsDatabase,
  dispatcher: NotificationService,
  invoiceId: string,
  input: SendInvoiceNotificationInput,
) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) {
    return null
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, invoice.bookingId))
    .limit(1)
  const [participants, items] = booking
    ? await Promise.all([
        listBookingNotificationParticipants(db, booking.id),
        listBookingNotificationItems(db, booking.id),
      ])
    : [[], []]
  const recipient = resolveReminderRecipient(booking ?? null, participants)

  const [latestSession] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.invoiceId, invoice.id))
    .orderBy(desc(paymentSessions.createdAt))
    .limit(1)

  const to = input.to ?? latestSession?.payerEmail ?? recipient?.email ?? null
  if (!to) {
    throw new NotificationError("No recipient available for invoice notification")
  }

  return sendNotification(db, dispatcher, {
    templateId: input.templateId ?? null,
    templateSlug: input.templateSlug ?? null,
    channel: input.channel,
    provider: input.provider ?? null,
    to,
    from: input.from ?? null,
    subject: input.subject ?? null,
    html: input.html ?? null,
    text: input.text ?? null,
    data: {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        status: invoice.status,
        currency: invoice.currency,
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        totalCents: invoice.totalCents,
        paidCents: invoice.paidCents,
        balanceDueCents: invoice.balanceDueCents,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
      },
      booking: booking
        ? {
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            startDate: booking.startDate,
            endDate: booking.endDate,
            sellCurrency: booking.sellCurrency,
            sellAmountCents: booking.sellAmountCents,
          }
        : null,
      paymentSession: latestSession
        ? {
            id: latestSession.id,
            status: latestSession.status,
            provider: latestSession.provider,
            paymentUrl: resolveNotificationPaymentUrl(latestSession.id, {
              paymentLinkBaseUrl: input.paymentLinkBaseUrl,
              redirectUrl: latestSession.redirectUrl,
            }),
            redirectUrl: latestSession.redirectUrl,
            expiresAt: latestSession.expiresAt,
            amountCents: latestSession.amountCents,
            currency: latestSession.currency,
          }
        : null,
      traveler: recipient
        ? {
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            email: recipient.email,
            participantType: recipient.participantType,
            isPrimary: recipient.isPrimary,
          }
        : null,
      travelers: participants,
      items,
      ...(input.data ?? {}),
    },
    targetType: "invoice",
    targetId: invoice.id,
    bookingId: invoice.bookingId,
    invoiceId: invoice.id,
    paymentSessionId: latestSession?.id ?? null,
    personId: invoice.personId ?? booking?.personId ?? null,
    organizationId: invoice.organizationId ?? booking?.organizationId ?? null,
    metadata: input.metadata ?? null,
    scheduledFor: input.scheduledFor ?? null,
  })
}
