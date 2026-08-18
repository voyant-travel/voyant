import { normalizeE164 } from "@voyant-travel/conversations-contracts"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  notificationChannelAccounts,
  notificationDeliveries,
  notificationDeliveryEvents,
} from "./schema.js"
import { enqueueNotification } from "./service-durable-send.js"
import { createNotificationService, NotificationError } from "./service-shared.js"
import { assertSmsAdmissionAllowed } from "./service-sms-policy.js"
import type {
  ChannelAccountDraft,
  NormalizedNotificationDeliveryEvent,
  NotificationProvider,
  RenderedServiceMessage,
  ValidatedChannelAccount,
} from "./types.js"

const QUALIFIED_TARGET_TYPE =
  /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)#[a-z0-9][a-z0-9._-]*$/i

export function listChannelAccounts(db: AnyDrizzleDb) {
  return db
    .select()
    .from(notificationChannelAccounts)
    .orderBy(notificationChannelAccounts.displayName, notificationChannelAccounts.id)
}

export async function getChannelAccount(db: AnyDrizzleDb, id: string) {
  const [account] = await db
    .select()
    .from(notificationChannelAccounts)
    .where(eq(notificationChannelAccounts.id, id))
    .limit(1)
  return account ?? null
}

/** Provisioning is deliberately adapter-mediated; callers cannot persist adapter configuration. */
export async function provisionChannelAccount(
  db: AnyDrizzleDb,
  adapter: NotificationProvider,
  draft: ChannelAccountDraft,
) {
  const capability = requireChannelAccountCapability(adapter)
  const provisioned = await capability.provision({
    ...draft,
    allowedPurposes: normalizePurposes(draft.allowedPurposes),
  })
  const validation = await capability.validate(provisioned.adapterRef)
  const normalizedAddress =
    draft.channel === "sms"
      ? normalizeE164(provisioned.normalizedAddress)
      : provisioned.normalizedAddress
  if (
    draft.channel === "sms" &&
    draft.inboundCapable &&
    (!validation.inboundCapable ||
      validation.inboundIdentity !== "unambiguous" ||
      !validation.inboundSourceId)
  ) {
    throw new NotificationError("Inbound SMS requires one unambiguous receiving identity")
  }
  const [existing] = await db
    .select()
    .from(notificationChannelAccounts)
    .where(eq(notificationChannelAccounts.adapterRef, provisioned.adapterRef))
    .limit(1)
  if (
    existing &&
    (existing.channel !== draft.channel ||
      existing.normalizedAddress !== normalizedAddress ||
      existing.displayName !== draft.displayName ||
      existing.displayAddress !== provisioned.displayAddress ||
      (draft.inboundCapable !== undefined && existing.inboundCapable !== draft.inboundCapable) ||
      (draft.outboundCapable !== undefined && existing.outboundCapable !== draft.outboundCapable) ||
      JSON.stringify(existing.allowedPurposes) !==
        JSON.stringify(normalizePurposes(draft.allowedPurposes)))
  ) {
    throw new NotificationError("Provisioned Channel Account replay payload drift")
  }
  if (existing?.lifecycle === "archived" || existing?.lifecycle === "disabled") {
    throw new NotificationError("Provision replay cannot reactivate a disabled Channel Account")
  }
  if (existing?.lifecycle === "active") return existing
  const [pending] = existing
    ? [existing]
    : await db
        .insert(notificationChannelAccounts)
        .values({
          channel: draft.channel,
          normalizedAddress,
          displayName: draft.displayName,
          displayAddress: provisioned.displayAddress,
          lifecycle: "pending",
          health: validation.health,
          inboundCapable: validation.inboundCapable,
          outboundCapable: validation.outboundCapable,
          inboundIdentity: validation.inboundIdentity ?? null,
          inboundSourceId: validation.inboundSourceId ?? null,
          attachmentsCapable: validation.attachmentsCapable ?? false,
          allowedPurposes: normalizePurposes(draft.allowedPurposes),
          adapterRef: provisioned.adapterRef,
          lastValidatedAt: new Date(),
        })
        .returning()
  if (!pending) throw new NotificationError("Failed to persist the provisioned Channel Account")
  await capability.activate?.({ channelAccountId: pending.id, adapterRef: pending.adapterRef })
  const [account] = await db
    .update(notificationChannelAccounts)
    .set({ lifecycle: "active", updatedAt: new Date() })
    .where(eq(notificationChannelAccounts.id, pending.id))
    .returning()
  if (!account) throw new NotificationError("Failed to activate the provisioned Channel Account")
  return account
}

/** Refresh health and capabilities through the same runtime boundary that owns the adapter ref. */
export async function validateChannelAccount(
  db: AnyDrizzleDb,
  adapters: ReadonlyArray<NotificationProvider>,
  id: string,
) {
  const account = await getChannelAccount(db, id)
  if (!account) return null
  const adapter = resolveAccountAdapter(adapters, account.adapterRef)
  let validation: ValidatedChannelAccount
  try {
    validation = await requireChannelAccountCapability(adapter).validate(account.adapterRef)
  } catch (error) {
    await db
      .update(notificationChannelAccounts)
      .set({ health: "unavailable", lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(notificationChannelAccounts.id, id))
    throw error
  }
  if (
    account.channel === "sms" &&
    account.inboundCapable &&
    (!validation.inboundCapable ||
      validation.inboundIdentity !== "unambiguous" ||
      !validation.inboundSourceId)
  ) {
    throw new NotificationError("Inbound SMS identity became ambiguous")
  }
  const [updated] = await db
    .update(notificationChannelAccounts)
    .set({ ...validation, lastValidatedAt: new Date(), updatedAt: new Date() })
    .where(eq(notificationChannelAccounts.id, id))
    .returning()
  return updated ?? null
}

const CHANNEL_ACCOUNT_LIFECYCLE_TRANSITIONS = {
  pending: ["active", "disabled", "archived"],
  active: ["disabled", "archived"],
  disabled: ["active", "archived"],
  archived: [],
} as const

export async function updateChannelAccountLifecycle(
  db: AnyDrizzleDb,
  id: string,
  lifecycle: "pending" | "active" | "disabled" | "archived",
) {
  const account = await getChannelAccount(db, id)
  if (!account) return null
  if (account.lifecycle === lifecycle) return account
  const allowed = CHANNEL_ACCOUNT_LIFECYCLE_TRANSITIONS[account.lifecycle]
  if (!(allowed as ReadonlyArray<string>).includes(lifecycle)) {
    throw new NotificationError(
      `Channel Account cannot transition from ${account.lifecycle} to ${lifecycle}`,
    )
  }
  const [updated] = await db
    .update(notificationChannelAccounts)
    .set({ lifecycle, updatedAt: new Date() })
    .where(eq(notificationChannelAccounts.id, id))
    .returning()
  return updated ?? null
}

/** Admit an already-rendered message into the existing durable send operation. */
export async function admitRenderedServiceMessage(
  db: PostgresJsDatabase,
  adapters: ReadonlyArray<NotificationProvider>,
  message: RenderedServiceMessage,
) {
  assertRenderedMessage(message)
  const account = await getChannelAccount(db, message.channelAccountId)
  if (!account) throw new NotificationError("Channel Account not found")
  if (account.lifecycle !== "active") {
    throw new NotificationError("Channel Account is not active")
  }
  if (!account.outboundCapable || account.health === "unavailable") {
    throw new NotificationError("Channel Account is not available for outbound messages")
  }
  if (!account.allowedPurposes.includes(message.purpose)) {
    throw new NotificationError(`Channel Account does not allow purpose "${message.purpose}"`)
  }
  if (message.channel && message.channel !== account.channel) {
    throw new NotificationError("Rendered message channel does not match its Channel Account")
  }
  const adapter = resolveAccountAdapter(adapters, account.adapterRef)
  if (!adapter.channels.includes(account.channel)) {
    throw new NotificationError("Channel Account adapter does not support its channel")
  }
  if (account.channel === "sms") {
    await assertSmsAdmissionAllowed(db, account.id, message.to)
  }

  return enqueueNotification({
    db,
    registry: createNotificationService(adapters),
    input: {
      idempotencyKey: message.idempotencyKey,
      channelAccountId: account.id,
      channel: account.channel,
      provider: adapter.name,
      to: message.to,
      from: account.normalizedAddress,
      subject: message.subject,
      text: message.text,
      html: message.sanitizedHtml,
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        privateHandle: attachment.privateHandle,
        contentType: attachment.contentType,
        disposition: attachment.disposition,
        contentId: attachment.contentId,
      })),
      data: {},
      targetType: "other",
      targetId: message.target.id,
      qualifiedTargetType: message.target.type,
      purpose: message.purpose,
      organizationId: message.organizationId,
      metadata: {
        ...(message.metadata ?? {}),
        ...(message.thread ? { thread: message.thread } : {}),
        renderedServiceMessage: true,
      },
    },
  })
}

/** Store a normalized adapter event once, then project the latest event onto delivery truth. */
export async function reconcileNotificationDeliveryEvent(
  db: PostgresJsDatabase,
  event: NormalizedNotificationDeliveryEvent,
) {
  return db.transaction(async (tx) => {
    const transaction = tx as AnyDrizzleDb
    const [delivery] = await transaction
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, event.deliveryId))
      .limit(1)
    if (!delivery) throw new NotificationError("Notification delivery not found")
    if (delivery.channelAccountId) {
      const [account] = await transaction
        .select({ adapterRef: notificationChannelAccounts.adapterRef })
        .from(notificationChannelAccounts)
        .where(eq(notificationChannelAccounts.id, delivery.channelAccountId))
        .limit(1)
      if (!account || account.adapterRef !== event.adapterRef) {
        throw new NotificationError("Delivery event does not belong to the Channel Account")
      }
    }

    const inserted = await transaction
      .insert(notificationDeliveryEvents)
      .values({
        deliveryId: event.deliveryId,
        adapterRef: event.adapterRef,
        adapterEventId: event.adapterEventId,
        status: event.status,
        occurredAt: event.occurredAt,
        details: event.details ?? null,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted.length === 0) {
      const [replayed] = await transaction
        .select()
        .from(notificationDeliveryEvents)
        .where(
          and(
            eq(notificationDeliveryEvents.adapterRef, event.adapterRef),
            eq(notificationDeliveryEvents.adapterEventId, event.adapterEventId),
          ),
        )
        .limit(1)
      const canonical = event.details?.canonicalPayload
      if (
        !replayed ||
        replayed.deliveryId !== event.deliveryId ||
        replayed.status !== event.status ||
        replayed.occurredAt.toISOString() !== event.occurredAt.toISOString() ||
        (canonical !== undefined && replayed.details?.canonicalPayload !== canonical)
      ) {
        throw new NotificationError("Delivery lifecycle replay payload drift")
      }
    }

    const [latest] = await transaction
      .select()
      .from(notificationDeliveryEvents)
      .where(eq(notificationDeliveryEvents.deliveryId, event.deliveryId))
      .orderBy(
        desc(notificationDeliveryEvents.occurredAt),
        desc(notificationDeliveryEvents.createdAt),
        desc(notificationDeliveryEvents.id),
      )
      .limit(1)
    if (!latest) throw new NotificationError("Delivery event ledger rejected the event")

    const projectedStatus =
      latest.status === "accepted" && !["pending", "accepted"].includes(delivery.status)
        ? delivery.status
        : latest.status
    const [updated] = await transaction
      .update(notificationDeliveries)
      .set({
        status: projectedStatus,
        acceptedAt: projectedStatus === "accepted" ? latest.occurredAt : delivery.acceptedAt,
        deliveredAt: projectedStatus === "delivered" ? latest.occurredAt : delivery.deliveredAt,
        failedAt: ["failed", "bounced", "complained", "suppressed"].includes(projectedStatus)
          ? latest.occurredAt
          : delivery.failedAt,
        errorMessage:
          typeof latest.details?.message === "string"
            ? latest.details.message.slice(0, 2_000)
            : delivery.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, event.deliveryId))
      .returning()
    if (!updated) throw new NotificationError("Failed to project delivery event")
    return { event: latest, delivery: updated, created: inserted.length === 1 }
  })
}

function requireChannelAccountCapability(adapter: NotificationProvider) {
  const capability = adapter.channelAccounts
  if (
    capability?.protocol !== "notification-channel-account-v1" ||
    typeof capability.matches !== "function" ||
    typeof capability.provision !== "function" ||
    typeof capability.validate !== "function"
  ) {
    throw new NotificationError("Selected notification adapter cannot manage Channel Accounts")
  }
  return capability
}

function resolveAccountAdapter(adapters: ReadonlyArray<NotificationProvider>, adapterRef: string) {
  const adapter = adapters.find((candidate) => candidate.channelAccounts?.matches(adapterRef))
  if (!adapter) throw new NotificationError("Channel Account adapter is not available")
  return adapter
}

function normalizePurposes(purposes: ReadonlyArray<string>) {
  return [...new Set(purposes.map((purpose) => purpose.trim()).filter(Boolean))].sort()
}

function assertRenderedMessage(message: RenderedServiceMessage) {
  if (!message.idempotencyKey.trim()) throw new NotificationError("idempotencyKey is required")
  if (!message.to.trim()) throw new NotificationError("recipient is required")
  if (!message.purpose.trim()) throw new NotificationError("purpose is required")
  if (!QUALIFIED_TARGET_TYPE.test(message.target.type) || !message.target.id.trim()) {
    throw new NotificationError("target must contain a package-qualified type and id")
  }
  if (!message.text && !message.sanitizedHtml) {
    throw new NotificationError("rendered message requires text or sanitizedHtml")
  }
  if (
    message.sanitizedHtml &&
    /<(?:script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript\s*:/i.test(message.sanitizedHtml)
  ) {
    throw new NotificationError("sanitizedHtml contains unsafe markup")
  }
  for (const attachment of message.attachments ?? []) {
    if (!attachment.privateHandle.trim() || !attachment.filename.trim()) {
      throw new NotificationError("attachments require a privateHandle and filename")
    }
  }
}
