import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  notificationReminderRules,
  notificationReminderRuns,
  notificationReminderStageChannels,
} from "./schema.js"
import type {
  NotificationReminderRuleRow,
  ReminderQueueResult,
  ReminderSweepResult,
} from "./service-shared.js"

export type ReminderDeliveryEnqueuer = (input: { reminderRunId: string }) => Promise<void>

export type NotificationReminderRunRow = typeof notificationReminderRuns.$inferSelect

export function buildReminderSweepSummary(): ReminderSweepResult {
  return {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  }
}

export function buildReminderQueueSummary(): ReminderQueueResult {
  return {
    processed: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
  }
}

export async function getReminderRuleById(db: PostgresJsDatabase, reminderRuleId: string) {
  const [rule] = await db
    .select()
    .from(notificationReminderRules)
    .where(eq(notificationReminderRules.id, reminderRuleId))
    .limit(1)
  return rule ?? null
}

export async function getReminderRunById(db: PostgresJsDatabase, reminderRunId: string) {
  const [run] = await db
    .select()
    .from(notificationReminderRuns)
    .where(eq(notificationReminderRuns.id, reminderRunId))
    .limit(1)
  return run ?? null
}

export async function markReminderRunSkipped(
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

export async function markReminderRunFailed(
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

export async function markReminderRunSent(
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

export type ChannelOverride = {
  channel: "email" | "sms"
  templateId: string | null
  templateSlug: string | null
  provider: string | null
}

export async function resolveChannelOverride(
  db: PostgresJsDatabase,
  run: NotificationReminderRunRow,
  rule: NotificationReminderRuleRow,
): Promise<ChannelOverride> {
  const stageChannelId =
    run.metadata && typeof run.metadata === "object"
      ? ((run.metadata as Record<string, unknown>).stageChannelId as string | undefined)
      : undefined
  if (stageChannelId) {
    const [stageChannel] = await db
      .select()
      .from(notificationReminderStageChannels)
      .where(eq(notificationReminderStageChannels.id, stageChannelId))
      .limit(1)
    if (stageChannel) {
      return {
        channel: stageChannel.channel,
        templateId: stageChannel.templateId ?? null,
        templateSlug: stageChannel.templateSlug ?? null,
        provider: stageChannel.provider ?? null,
      }
    }
  }
  return {
    channel: rule.channel,
    templateId: rule.templateId ?? null,
    templateSlug: rule.templateSlug ?? null,
    provider: rule.provider ?? null,
  }
}
