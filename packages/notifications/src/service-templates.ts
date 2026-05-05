import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  notificationDeliveries,
  notificationReminderRules,
  notificationReminderRuns,
  notificationTemplates,
} from "./schema.js"
import type {
  CreateNotificationReminderRuleInput,
  CreateNotificationTemplateInput,
  NotificationReminderRuleListQuery,
  NotificationReminderRunListQuery,
  NotificationReminderRunRecord,
  NotificationTemplateListQuery,
  UpdateNotificationReminderRuleInput,
  UpdateNotificationTemplateInput,
} from "./service-shared.js"
import { buildWhereClause, paginate } from "./service-shared.js"

function normalizeDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function normalizeReminderRun(row: {
  id: string
  reminderRuleId: string
  targetType: NotificationReminderRunRecord["targetType"]
  targetId: string
  dedupeKey: string
  bookingId: string | null
  personId: string | null
  organizationId: string | null
  paymentSessionId: string | null
  notificationDeliveryId: string | null
  status: "queued" | "processing" | "sent" | "skipped" | "failed"
  recipient: string | null
  scheduledFor: Date | string
  processedAt: Date | string
  errorMessage: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date | string
  updatedAt: Date | string
  ruleSlug: string
  ruleName: string
  ruleStatus: "draft" | "active" | "archived"
  ruleTargetType: NotificationReminderRunRecord["targetType"]
  ruleChannel: "email" | "sms"
  ruleProvider: string | null
  ruleTemplateId: string | null
  ruleTemplateSlug: string | null
  relativeDaysFromDueDate: number
  deliveryId: string | null
  deliveryStatus: "pending" | "sent" | "failed" | "cancelled" | null
  deliveryChannel: "email" | "sms" | null
  deliveryProvider: string | null
  toAddress: string | null
  deliverySubject: string | null
  sentAt: Date | string | null
  failedAt: Date | string | null
  deliveryErrorMessage: string | null
}): NotificationReminderRunRecord {
  return {
    id: row.id,
    reminderRuleId: row.reminderRuleId,
    targetType: row.targetType,
    targetId: row.targetId,
    dedupeKey: row.dedupeKey,
    status: row.status,
    recipient: row.recipient ?? null,
    scheduledFor: normalizeDateTime(row.scheduledFor)!,
    processedAt: normalizeDateTime(row.processedAt)!,
    errorMessage: row.errorMessage ?? null,
    metadata: row.metadata ?? null,
    createdAt: normalizeDateTime(row.createdAt)!,
    updatedAt: normalizeDateTime(row.updatedAt)!,
    links: {
      bookingId: row.bookingId ?? null,
      bookingPaymentScheduleId: row.targetType === "booking_payment_schedule" ? row.targetId : null,
      invoiceId: row.targetType === "invoice" ? row.targetId : null,
      paymentSessionId: row.paymentSessionId ?? null,
      personId: row.personId ?? null,
      organizationId: row.organizationId ?? null,
      notificationDeliveryId: row.notificationDeliveryId ?? null,
    },
    reminderRule: {
      id: row.reminderRuleId,
      slug: row.ruleSlug,
      name: row.ruleName,
      status: row.ruleStatus,
      targetType: row.ruleTargetType,
      channel: row.ruleChannel,
      provider: row.ruleProvider ?? null,
      templateId: row.ruleTemplateId ?? null,
      templateSlug: row.ruleTemplateSlug ?? null,
      relativeDaysFromDueDate: row.relativeDaysFromDueDate,
    },
    delivery:
      row.deliveryId &&
      row.deliveryStatus &&
      row.deliveryChannel &&
      row.deliveryProvider &&
      row.toAddress
        ? {
            id: row.deliveryId,
            status: row.deliveryStatus,
            channel: row.deliveryChannel,
            provider: row.deliveryProvider,
            toAddress: row.toAddress,
            subject: row.deliverySubject ?? null,
            sentAt: normalizeDateTime(row.sentAt),
            failedAt: normalizeDateTime(row.failedAt),
            errorMessage: row.deliveryErrorMessage ?? null,
          }
        : null,
  }
}

export async function listTemplates(db: PostgresJsDatabase, query: NotificationTemplateListQuery) {
  const conditions = []
  if (query.channel) conditions.push(eq(notificationTemplates.channel, query.channel))
  if (query.provider) conditions.push(eq(notificationTemplates.provider, query.provider))
  if (query.status) conditions.push(eq(notificationTemplates.status, query.status))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(
      or(ilike(notificationTemplates.slug, term), ilike(notificationTemplates.name, term)),
    )
  }

  const where = buildWhereClause(conditions)
  return paginate(
    db
      .select()
      .from(notificationTemplates)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(notificationTemplates.updatedAt)),
    db.select({ total: sql<number>`count(*)::int` }).from(notificationTemplates).where(where),
    query.limit,
    query.offset,
  )
}

export async function getTemplateById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, id))
    .limit(1)
  return row ?? null
}

export async function getTemplateBySlug(db: PostgresJsDatabase, slug: string) {
  const [row] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.slug, slug))
    .limit(1)
  return row ?? null
}

export async function createTemplate(
  db: PostgresJsDatabase,
  data: CreateNotificationTemplateInput,
) {
  const [row] = await db.insert(notificationTemplates).values(data).returning()
  return row ?? null
}

export async function updateTemplate(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateNotificationTemplateInput,
) {
  const [row] = await db
    .update(notificationTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notificationTemplates.id, id))
    .returning()
  return row ?? null
}

export async function listReminderRules(
  db: PostgresJsDatabase,
  query: NotificationReminderRuleListQuery,
) {
  const conditions = []
  if (query.status) conditions.push(eq(notificationReminderRules.status, query.status))
  if (query.targetType) conditions.push(eq(notificationReminderRules.targetType, query.targetType))
  if (query.channel) conditions.push(eq(notificationReminderRules.channel, query.channel))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(
      or(ilike(notificationReminderRules.slug, term), ilike(notificationReminderRules.name, term)),
    )
  }

  const where = buildWhereClause(conditions)
  return paginate(
    db
      .select()
      .from(notificationReminderRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(notificationReminderRules.updatedAt)),
    db.select({ total: sql<number>`count(*)::int` }).from(notificationReminderRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getReminderRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(notificationReminderRules)
    .where(eq(notificationReminderRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createReminderRule(
  db: PostgresJsDatabase,
  data: CreateNotificationReminderRuleInput,
) {
  const [row] = await db.insert(notificationReminderRules).values(data).returning()
  return row ?? null
}

export async function updateReminderRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateNotificationReminderRuleInput,
) {
  const [row] = await db
    .update(notificationReminderRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notificationReminderRules.id, id))
    .returning()
  return row ?? null
}

export async function listReminderRuns(
  db: PostgresJsDatabase,
  query: NotificationReminderRunListQuery,
) {
  const conditions = []
  if (query.reminderRuleId) {
    conditions.push(eq(notificationReminderRuns.reminderRuleId, query.reminderRuleId))
  }
  if (query.targetType) conditions.push(eq(notificationReminderRuns.targetType, query.targetType))
  if (query.targetId) conditions.push(eq(notificationReminderRuns.targetId, query.targetId))
  if (query.scheduleId) {
    conditions.push(
      and(
        eq(notificationReminderRuns.targetType, "booking_payment_schedule"),
        eq(notificationReminderRuns.targetId, query.scheduleId),
      ),
    )
  }
  if (query.invoiceId) {
    conditions.push(
      and(
        eq(notificationReminderRuns.targetType, "invoice"),
        eq(notificationReminderRuns.targetId, query.invoiceId),
      ),
    )
  }
  if (query.bookingId) conditions.push(eq(notificationReminderRuns.bookingId, query.bookingId))
  if (query.paymentSessionId) {
    conditions.push(eq(notificationReminderRuns.paymentSessionId, query.paymentSessionId))
  }
  if (query.notificationDeliveryId) {
    conditions.push(
      eq(notificationReminderRuns.notificationDeliveryId, query.notificationDeliveryId),
    )
  }
  if (query.personId) conditions.push(eq(notificationReminderRuns.personId, query.personId))
  if (query.organizationId) {
    conditions.push(eq(notificationReminderRuns.organizationId, query.organizationId))
  }
  if (query.recipient) {
    conditions.push(eq(notificationReminderRuns.recipient, query.recipient))
  }
  if (query.status) conditions.push(eq(notificationReminderRuns.status, query.status))

  const where = buildWhereClause(conditions)
  return paginate(
    db
      .select({
        id: notificationReminderRuns.id,
        reminderRuleId: notificationReminderRuns.reminderRuleId,
        targetType: notificationReminderRuns.targetType,
        targetId: notificationReminderRuns.targetId,
        dedupeKey: notificationReminderRuns.dedupeKey,
        bookingId: notificationReminderRuns.bookingId,
        personId: notificationReminderRuns.personId,
        organizationId: notificationReminderRuns.organizationId,
        paymentSessionId: notificationReminderRuns.paymentSessionId,
        notificationDeliveryId: notificationReminderRuns.notificationDeliveryId,
        status: notificationReminderRuns.status,
        recipient: notificationReminderRuns.recipient,
        scheduledFor: notificationReminderRuns.scheduledFor,
        processedAt: notificationReminderRuns.processedAt,
        errorMessage: notificationReminderRuns.errorMessage,
        metadata: notificationReminderRuns.metadata,
        createdAt: notificationReminderRuns.createdAt,
        updatedAt: notificationReminderRuns.updatedAt,
        ruleSlug: notificationReminderRules.slug,
        ruleName: notificationReminderRules.name,
        ruleStatus: notificationReminderRules.status,
        ruleTargetType: notificationReminderRules.targetType,
        ruleChannel: notificationReminderRules.channel,
        ruleProvider: notificationReminderRules.provider,
        ruleTemplateId: notificationReminderRules.templateId,
        ruleTemplateSlug: notificationReminderRules.templateSlug,
        relativeDaysFromDueDate: notificationReminderRules.relativeDaysFromDueDate,
        deliveryId: notificationDeliveries.id,
        deliveryStatus: notificationDeliveries.status,
        deliveryChannel: notificationDeliveries.channel,
        deliveryProvider: notificationDeliveries.provider,
        toAddress: notificationDeliveries.toAddress,
        deliverySubject: notificationDeliveries.subject,
        sentAt: notificationDeliveries.sentAt,
        failedAt: notificationDeliveries.failedAt,
        deliveryErrorMessage: notificationDeliveries.errorMessage,
      })
      .from(notificationReminderRuns)
      .innerJoin(
        notificationReminderRules,
        eq(notificationReminderRules.id, notificationReminderRuns.reminderRuleId),
      )
      .leftJoin(
        notificationDeliveries,
        eq(notificationDeliveries.id, notificationReminderRuns.notificationDeliveryId),
      )
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(notificationReminderRuns.createdAt))
      .then((rows) => rows.map(normalizeReminderRun)),
    db.select({ total: sql<number>`count(*)::int` }).from(notificationReminderRuns).where(where),
    query.limit,
    query.offset,
  )
}

export async function getReminderRunById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select({
      id: notificationReminderRuns.id,
      reminderRuleId: notificationReminderRuns.reminderRuleId,
      targetType: notificationReminderRuns.targetType,
      targetId: notificationReminderRuns.targetId,
      dedupeKey: notificationReminderRuns.dedupeKey,
      bookingId: notificationReminderRuns.bookingId,
      personId: notificationReminderRuns.personId,
      organizationId: notificationReminderRuns.organizationId,
      paymentSessionId: notificationReminderRuns.paymentSessionId,
      notificationDeliveryId: notificationReminderRuns.notificationDeliveryId,
      status: notificationReminderRuns.status,
      recipient: notificationReminderRuns.recipient,
      scheduledFor: notificationReminderRuns.scheduledFor,
      processedAt: notificationReminderRuns.processedAt,
      errorMessage: notificationReminderRuns.errorMessage,
      metadata: notificationReminderRuns.metadata,
      createdAt: notificationReminderRuns.createdAt,
      updatedAt: notificationReminderRuns.updatedAt,
      ruleSlug: notificationReminderRules.slug,
      ruleName: notificationReminderRules.name,
      ruleStatus: notificationReminderRules.status,
      ruleTargetType: notificationReminderRules.targetType,
      ruleChannel: notificationReminderRules.channel,
      ruleProvider: notificationReminderRules.provider,
      ruleTemplateId: notificationReminderRules.templateId,
      ruleTemplateSlug: notificationReminderRules.templateSlug,
      relativeDaysFromDueDate: notificationReminderRules.relativeDaysFromDueDate,
      deliveryId: notificationDeliveries.id,
      deliveryStatus: notificationDeliveries.status,
      deliveryChannel: notificationDeliveries.channel,
      deliveryProvider: notificationDeliveries.provider,
      toAddress: notificationDeliveries.toAddress,
      deliverySubject: notificationDeliveries.subject,
      sentAt: notificationDeliveries.sentAt,
      failedAt: notificationDeliveries.failedAt,
      deliveryErrorMessage: notificationDeliveries.errorMessage,
    })
    .from(notificationReminderRuns)
    .innerJoin(
      notificationReminderRules,
      eq(notificationReminderRules.id, notificationReminderRuns.reminderRuleId),
    )
    .leftJoin(
      notificationDeliveries,
      eq(notificationDeliveries.id, notificationReminderRuns.notificationDeliveryId),
    )
    .where(eq(notificationReminderRuns.id, id))
    .limit(1)

  return row ? normalizeReminderRun(row) : null
}
