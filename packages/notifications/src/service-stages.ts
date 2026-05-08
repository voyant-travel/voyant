import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  type NotificationReminderRuleStage,
  type NotificationReminderStageChannel,
  type NotificationSettings,
  notificationReminderRuleStages,
  notificationReminderStageChannels,
  notificationSettings,
} from "./schema.js"
import { DEFAULT_NOTIFICATION_SETTINGS } from "./service-sequence.js"
import type {
  insertNotificationReminderRuleStageSchema,
  insertNotificationReminderStageChannelSchema,
  reorderReminderRuleStagesSchema,
  updateNotificationReminderRuleStageSchema,
  updateNotificationReminderStageChannelSchema,
  updateNotificationSettingsSchema,
} from "./validation.js"

export type CreateReminderRuleStageInput = z.infer<typeof insertNotificationReminderRuleStageSchema>
export type UpdateReminderRuleStageInput = z.infer<typeof updateNotificationReminderRuleStageSchema>
export type CreateReminderStageChannelInput = z.infer<
  typeof insertNotificationReminderStageChannelSchema
>
export type UpdateReminderStageChannelInput = z.infer<
  typeof updateNotificationReminderStageChannelSchema
>
export type ReorderReminderRuleStagesInput = z.infer<typeof reorderReminderRuleStagesSchema>
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>

export async function listReminderRuleStages(
  db: PostgresJsDatabase,
  reminderRuleId: string,
): Promise<NotificationReminderRuleStage[]> {
  return db
    .select()
    .from(notificationReminderRuleStages)
    .where(eq(notificationReminderRuleStages.reminderRuleId, reminderRuleId))
    .orderBy(asc(notificationReminderRuleStages.orderIndex))
}

export async function getReminderRuleStageById(
  db: PostgresJsDatabase,
  stageId: string,
): Promise<NotificationReminderRuleStage | null> {
  const [row] = await db
    .select()
    .from(notificationReminderRuleStages)
    .where(eq(notificationReminderRuleStages.id, stageId))
    .limit(1)
  return row ?? null
}

export async function createReminderRuleStage(
  db: PostgresJsDatabase,
  reminderRuleId: string,
  input: CreateReminderRuleStageInput,
): Promise<NotificationReminderRuleStage> {
  const [row] = await db
    .insert(notificationReminderRuleStages)
    .values({
      reminderRuleId,
      orderIndex: input.orderIndex,
      name: input.name ?? null,
      anchor: input.anchor,
      windowStartDays: input.windowStartDays,
      windowEndDays: input.windowEndDays,
      cadenceKind: input.cadenceKind,
      cadenceEveryDays: input.cadenceEveryDays ?? null,
      cadenceIntervals: input.cadenceIntervals ?? null,
      maxSendsInStage: input.maxSendsInStage ?? null,
      respectQuietHours: input.respectQuietHours,
      metadata: input.metadata ?? null,
    })
    .returning()
  if (!row) throw new Error("Failed to create reminder stage")
  return row
}

export async function updateReminderRuleStage(
  db: PostgresJsDatabase,
  stageId: string,
  input: UpdateReminderRuleStageInput,
): Promise<NotificationReminderRuleStage | null> {
  const updates: Partial<NotificationReminderRuleStage> = { updatedAt: new Date() }
  if (input.name !== undefined) updates.name = input.name ?? null
  if (input.orderIndex !== undefined) updates.orderIndex = input.orderIndex
  if (input.anchor !== undefined) updates.anchor = input.anchor
  if (input.windowStartDays !== undefined) updates.windowStartDays = input.windowStartDays
  if (input.windowEndDays !== undefined) updates.windowEndDays = input.windowEndDays
  if (input.cadenceKind !== undefined) updates.cadenceKind = input.cadenceKind
  if (input.cadenceEveryDays !== undefined)
    updates.cadenceEveryDays = input.cadenceEveryDays ?? null
  if (input.cadenceIntervals !== undefined)
    updates.cadenceIntervals = input.cadenceIntervals ?? null
  if (input.maxSendsInStage !== undefined) updates.maxSendsInStage = input.maxSendsInStage ?? null
  if (input.respectQuietHours !== undefined) updates.respectQuietHours = input.respectQuietHours
  if (input.metadata !== undefined) updates.metadata = input.metadata ?? null
  const [row] = await db
    .update(notificationReminderRuleStages)
    .set(updates)
    .where(eq(notificationReminderRuleStages.id, stageId))
    .returning()
  return row ?? null
}

export async function deleteReminderRuleStage(
  db: PostgresJsDatabase,
  stageId: string,
): Promise<boolean> {
  const rows = await db
    .delete(notificationReminderRuleStages)
    .where(eq(notificationReminderRuleStages.id, stageId))
    .returning({ id: notificationReminderRuleStages.id })
  return rows.length > 0
}

export async function reorderReminderRuleStages(
  db: PostgresJsDatabase,
  reminderRuleId: string,
  input: ReorderReminderRuleStagesInput,
): Promise<NotificationReminderRuleStage[]> {
  const now = new Date()
  await db.transaction(async (tx) => {
    for (let i = 0; i < input.stageIds.length; i += 1) {
      const stageId = input.stageIds[i]!
      await tx
        .update(notificationReminderRuleStages)
        .set({ orderIndex: i, updatedAt: now })
        .where(
          and(
            eq(notificationReminderRuleStages.id, stageId),
            eq(notificationReminderRuleStages.reminderRuleId, reminderRuleId),
          ),
        )
    }
  })
  return listReminderRuleStages(db, reminderRuleId)
}

export async function listStageChannels(
  db: PostgresJsDatabase,
  stageId: string,
): Promise<NotificationReminderStageChannel[]> {
  return db
    .select()
    .from(notificationReminderStageChannels)
    .where(eq(notificationReminderStageChannels.stageId, stageId))
    .orderBy(
      asc(notificationReminderStageChannels.orderIndex),
      asc(notificationReminderStageChannels.createdAt),
    )
}

export async function createStageChannel(
  db: PostgresJsDatabase,
  stageId: string,
  input: CreateReminderStageChannelInput,
): Promise<NotificationReminderStageChannel> {
  const [row] = await db
    .insert(notificationReminderStageChannels)
    .values({
      stageId,
      orderIndex: input.orderIndex,
      channel: input.channel,
      provider: input.provider ?? null,
      templateId: input.templateId ?? null,
      templateSlug: input.templateSlug ?? null,
      recipientKind: input.recipientKind,
      recipientRole: input.recipientRole ?? null,
      metadata: input.metadata ?? null,
    })
    .returning()
  if (!row) throw new Error("Failed to create stage channel")
  return row
}

export async function updateStageChannel(
  db: PostgresJsDatabase,
  channelId: string,
  input: UpdateReminderStageChannelInput,
): Promise<NotificationReminderStageChannel | null> {
  const updates: Partial<NotificationReminderStageChannel> = { updatedAt: new Date() }
  if (input.orderIndex !== undefined) updates.orderIndex = input.orderIndex
  if (input.channel !== undefined) updates.channel = input.channel
  if (input.provider !== undefined) updates.provider = input.provider ?? null
  if (input.templateId !== undefined) updates.templateId = input.templateId ?? null
  if (input.templateSlug !== undefined) updates.templateSlug = input.templateSlug ?? null
  if (input.recipientKind !== undefined) updates.recipientKind = input.recipientKind
  if (input.recipientRole !== undefined) updates.recipientRole = input.recipientRole ?? null
  if (input.metadata !== undefined) updates.metadata = input.metadata ?? null
  const [row] = await db
    .update(notificationReminderStageChannels)
    .set(updates)
    .where(eq(notificationReminderStageChannels.id, channelId))
    .returning()
  return row ?? null
}

export async function deleteStageChannel(
  db: PostgresJsDatabase,
  channelId: string,
): Promise<boolean> {
  const rows = await db
    .delete(notificationReminderStageChannels)
    .where(eq(notificationReminderStageChannels.id, channelId))
    .returning({ id: notificationReminderStageChannels.id })
  return rows.length > 0
}

export async function getNotificationSettingsRecord(
  db: PostgresJsDatabase,
  scope = "default",
): Promise<NotificationSettings> {
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.scope, scope))
    .limit(1)
  return row ?? { ...DEFAULT_NOTIFICATION_SETTINGS, scope }
}

export async function upsertNotificationSettings(
  db: PostgresJsDatabase,
  input: UpdateNotificationSettingsInput,
): Promise<NotificationSettings> {
  const scope = input.scope ?? "default"
  const existing = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.scope, scope))
    .limit(1)

  const updates: Partial<NotificationSettings> = { updatedAt: new Date() }
  if (input.quietHoursLocal !== undefined) updates.quietHoursLocal = input.quietHoursLocal ?? null
  if (input.blackoutDates !== undefined) updates.blackoutDates = input.blackoutDates ?? null
  if (input.skipWeekends !== undefined) updates.skipWeekends = input.skipWeekends
  if (input.holidayCalendar !== undefined) updates.holidayCalendar = input.holidayCalendar ?? null
  if (input.recipientRateLimitPerDay !== undefined)
    updates.recipientRateLimitPerDay = input.recipientRateLimitPerDay ?? null
  if (input.suppressionWindowHours !== undefined)
    updates.suppressionWindowHours = input.suppressionWindowHours
  if (input.metadata !== undefined) updates.metadata = input.metadata ?? null

  if (existing[0]) {
    const [row] = await db
      .update(notificationSettings)
      .set(updates)
      .where(eq(notificationSettings.scope, scope))
      .returning()
    if (!row) throw new Error("Failed to update notification settings")
    return row
  }

  const [row] = await db
    .insert(notificationSettings)
    .values({
      scope,
      quietHoursLocal: input.quietHoursLocal ?? null,
      blackoutDates: input.blackoutDates ?? null,
      skipWeekends: input.skipWeekends ?? false,
      holidayCalendar: input.holidayCalendar ?? null,
      recipientRateLimitPerDay: input.recipientRateLimitPerDay ?? null,
      suppressionWindowHours: input.suppressionWindowHours ?? 24,
      metadata: input.metadata ?? null,
    })
    .returning()
  if (!row) throw new Error("Failed to create notification settings")
  return row
}
