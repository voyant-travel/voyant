import {
  type NotificationReminderRun,
  notificationDeliveries,
  notificationReminderRules,
  notificationReminderRuns,
} from "@voyantjs/notifications"
import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { CheckoutReminderRunListQuery } from "./validation.js"

function normalizeRequiredDateTime(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

export interface CheckoutReminderRunSummary {
  id: string
  reminderRuleId: string
  reminderRuleSlug: string | null
  reminderRuleName: string | null
  targetType: NotificationReminderRun["targetType"]
  targetId: string
  bookingId: string | null
  paymentSessionId: string | null
  notificationDeliveryId: string | null
  status: "queued" | "processing" | "sent" | "skipped" | "failed"
  deliveryStatus: "pending" | "sent" | "failed" | "cancelled" | null
  channel: "email" | "sms" | null
  provider: string | null
  recipient: string | null
  scheduledFor: string
  processedAt: string
  errorMessage: string | null
  relativeDaysFromDueDate: number | null
  createdAt: string
}

export interface CheckoutReminderRunList {
  data: CheckoutReminderRunSummary[]
  total: number
  limit: number
  offset: number
}

export async function listBookingReminderRuns(
  db: PostgresJsDatabase,
  bookingId: string,
  query: CheckoutReminderRunListQuery,
): Promise<CheckoutReminderRunList> {
  const where = and(
    eq(notificationReminderRuns.bookingId, bookingId),
    ...(query.status ? [eq(notificationReminderRuns.status, query.status)] : []),
  )

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: notificationReminderRuns.id,
        reminderRuleId: notificationReminderRuns.reminderRuleId,
        targetType: notificationReminderRuns.targetType,
        targetId: notificationReminderRuns.targetId,
        bookingId: notificationReminderRuns.bookingId,
        paymentSessionId: notificationReminderRuns.paymentSessionId,
        notificationDeliveryId: notificationReminderRuns.notificationDeliveryId,
        status: notificationReminderRuns.status,
        recipient: notificationReminderRuns.recipient,
        scheduledFor: notificationReminderRuns.scheduledFor,
        processedAt: notificationReminderRuns.processedAt,
        errorMessage: notificationReminderRuns.errorMessage,
        createdAt: notificationReminderRuns.createdAt,
        reminderRuleSlug: notificationReminderRules.slug,
        reminderRuleName: notificationReminderRules.name,
        channel: notificationReminderRules.channel,
        ruleProvider: notificationReminderRules.provider,
        deliveryStatus: notificationDeliveries.status,
        deliveryProvider: notificationDeliveries.provider,
      })
      .from(notificationReminderRuns)
      .leftJoin(
        notificationReminderRules,
        eq(notificationReminderRules.id, notificationReminderRuns.reminderRuleId),
      )
      .leftJoin(
        notificationDeliveries,
        eq(notificationDeliveries.id, notificationReminderRuns.notificationDeliveryId),
      )
      .where(where)
      .orderBy(desc(notificationReminderRuns.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(notificationReminderRuns).where(where),
  ])

  return {
    data: rows.map((row) => ({
      id: row.id,
      reminderRuleId: row.reminderRuleId,
      reminderRuleSlug: row.reminderRuleSlug ?? null,
      reminderRuleName: row.reminderRuleName ?? null,
      targetType: row.targetType,
      targetId: row.targetId,
      bookingId: row.bookingId ?? null,
      paymentSessionId: row.paymentSessionId ?? null,
      notificationDeliveryId: row.notificationDeliveryId ?? null,
      status: row.status,
      deliveryStatus: row.deliveryStatus ?? null,
      channel: row.channel ?? null,
      provider: row.deliveryProvider ?? row.ruleProvider ?? null,
      recipient: row.recipient ?? null,
      scheduledFor: normalizeRequiredDateTime(row.scheduledFor),
      processedAt: normalizeRequiredDateTime(row.processedAt),
      errorMessage: row.errorMessage ?? null,
      relativeDaysFromDueDate: null,
      createdAt: normalizeRequiredDateTime(row.createdAt),
    })),
    total: countResult[0]?.count ?? 0,
    limit: query.limit,
    offset: query.offset,
  }
}
