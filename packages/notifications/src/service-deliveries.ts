import { sha256 } from "@voyant-travel/action-ledger/fingerprint"
import { bookings } from "@voyant-travel/bookings/schema"
import { invoices, paymentSessions } from "@voyant-travel/finance/schema"
import { desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { notificationDeliveries, notificationDeliveryRequests } from "./schema.js"
import {
  attachmentsFromMetadata,
  metadataWithoutFailureLog,
  normalizeDeliveryAttachments,
  resolveNotificationPaymentUrl,
  serializeNotificationError,
} from "./service-delivery-metadata.js"
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
  NotificationIdempotencyConflictError,
  paginate,
  renderNotificationTemplate,
  resolveReminderRecipient,
  summarizeNotificationAttachments,
  toTimestamp,
} from "./service-shared.js"
import { getTemplateById, getTemplateBySlug } from "./service-templates.js"
import type { NotificationProvider } from "./types.js"

export { resolveNotificationPaymentUrl } from "./service-delivery-metadata.js"

function normalizeSenderAddress(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function resolveDeliverySender(input: {
  channel: string
  provider: NotificationProvider
  inputFrom?: string | null
  templateFrom?: string | null
}) {
  const explicitFrom =
    normalizeSenderAddress(input.inputFrom) ?? normalizeSenderAddress(input.templateFrom)
  if (explicitFrom) return explicitFrom

  if (input.channel !== "email") return null

  const from = normalizeSenderAddress(input.provider.defaultFromAddress)
  if (!from) {
    throw new NotificationError(
      `No email sender configured for notification provider "${input.provider.name}". Configure a verified sending domain/sender or pass \`from\`.`,
    )
  }

  return from
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
    db.select({ count: sql<number>`count(*)::int` }).from(notificationDeliveries).where(where),
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
  const idempotencyFingerprint = input.idempotencyKey
    ? `sha256:${await sha256({ ...input, idempotencyKey: null })}`
    : null
  if (input.idempotencyKey) {
    const replay = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`notifications.send:${input.idempotencyKey}`}))`,
      )
      const [request] = await tx
        .select()
        .from(notificationDeliveryRequests)
        .where(eq(notificationDeliveryRequests.idempotencyKey, input.idempotencyKey))
        .limit(1)
      if (!request) return null
      if (request.requestFingerprint !== idempotencyFingerprint) {
        throw new NotificationIdempotencyConflictError()
      }
      const [delivery] = await tx
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.id, request.deliveryId))
        .limit(1)
      if (!delivery) throw new NotificationError("Idempotent notification lost its delivery")
      return delivery
    })
    if (replay) return replay
  }
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

  const defaultProvider = dispatcher.getProvider(channel)
  const provider = input.provider ?? template?.provider ?? defaultProvider?.name
  if (!provider) {
    throw new NotificationError(`No notification provider available for channel "${channel}"`)
  }
  const selectedProvider =
    provider === defaultProvider?.name ? defaultProvider : dispatcher.getProviderByName?.(provider)
  if (!selectedProvider) {
    throw new NotificationError(`No notification provider registered with name "${provider}"`)
  }

  const subject = input.subject ?? renderNotificationTemplate(template?.subjectTemplate, data)
  const html = input.html ?? renderNotificationTemplate(template?.htmlTemplate, data)
  const text = input.text ?? renderNotificationTemplate(template?.textTemplate, data)
  const attachments = normalizeDeliveryAttachments(input.attachments)
  const attachmentSummary = summarizeNotificationAttachments(attachments)
  const fromAddress = resolveDeliverySender({
    channel,
    provider: selectedProvider,
    inputFrom: input.from,
    templateFrom: template?.fromAddress,
  })

  const pendingValues: typeof notificationDeliveries.$inferInsert = {
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
    fromAddress,
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
  }

  const prepared = input.idempotencyKey
    ? await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`notifications.send:${input.idempotencyKey}`}))`,
        )
        const [existingRequest] = await tx
          .select()
          .from(notificationDeliveryRequests)
          .where(eq(notificationDeliveryRequests.idempotencyKey, input.idempotencyKey))
          .limit(1)
        if (existingRequest) {
          if (existingRequest.requestFingerprint !== idempotencyFingerprint) {
            throw new NotificationIdempotencyConflictError()
          }
          const [existing] = await tx
            .select()
            .from(notificationDeliveries)
            .where(eq(notificationDeliveries.id, existingRequest.deliveryId))
            .limit(1)
          if (!existing) throw new NotificationError("Idempotent notification lost its delivery")
          return { row: existing, fresh: false }
        }
        const [created] = await tx.insert(notificationDeliveries).values(pendingValues).returning()
        if (created) {
          await tx.insert(notificationDeliveryRequests).values({
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: idempotencyFingerprint!,
            deliveryId: created.id,
          })
        }
        return { row: created, fresh: true }
      })
    : {
        row: (await db.insert(notificationDeliveries).values(pendingValues).returning())[0],
        fresh: true,
      }
  const pending = prepared.row

  if (!pending) {
    throw new NotificationError("Failed to create notification delivery")
  }

  if (!prepared.fresh) return pending

  try {
    const result =
      provider === defaultProvider?.name
        ? await dispatcher.send({
            to: input.to,
            channel,
            provider,
            template: template?.slug ?? input.templateSlug ?? "direct",
            data,
            from: fromAddress ?? undefined,
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
            from: fromAddress ?? undefined,
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
