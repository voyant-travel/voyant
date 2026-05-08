import {
  notificationChannelSchema,
  notificationDeliveryStatusSchema,
  notificationReminderRunRecordSchema,
  notificationReminderRunStatusSchema,
  notificationReminderStatusSchema,
  notificationReminderTargetTypeSchema,
  notificationTargetTypeSchema,
  previewNotificationTemplateResultSchema as notificationTemplatePreviewRecordSchema,
  notificationTemplateStatusSchema,
} from "@voyantjs/notifications"
import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const notificationTemplateRecordSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  channel: notificationChannelSchema,
  provider: z.string().nullable(),
  status: notificationTemplateStatusSchema,
  subjectTemplate: z.string().nullable(),
  htmlTemplate: z.string().nullable(),
  textTemplate: z.string().nullable(),
  fromAddress: z.string().nullable(),
  isSystem: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type NotificationTemplateRecord = z.infer<typeof notificationTemplateRecordSchema>

export const notificationDeliveryRecordSchema = z.object({
  id: z.string(),
  templateId: z.string().nullable(),
  templateSlug: z.string().nullable(),
  targetType: notificationTargetTypeSchema,
  targetId: z.string().nullable(),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  bookingId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  paymentSessionId: z.string().nullable(),
  channel: notificationChannelSchema,
  provider: z.string(),
  providerMessageId: z.string().nullable(),
  status: notificationDeliveryStatusSchema,
  toAddress: z.string(),
  fromAddress: z.string().nullable(),
  subject: z.string().nullable(),
  htmlBody: z.string().nullable(),
  textBody: z.string().nullable(),
  payloadData: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  errorMessage: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  sentAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type NotificationDeliveryRecord = z.infer<typeof notificationDeliveryRecordSchema>

export const notificationReminderRuleRecordSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: notificationReminderStatusSchema,
  targetType: notificationReminderTargetTypeSchema,
  channel: notificationChannelSchema,
  provider: z.string().nullable(),
  templateId: z.string().nullable(),
  templateSlug: z.string().nullable(),
  relativeDaysFromDueDate: z.number().int(),
  isSystem: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type NotificationReminderRuleRecord = z.infer<typeof notificationReminderRuleRecordSchema>
export type NotificationReminderRunRecord = z.infer<typeof notificationReminderRunRecordSchema>
export type NotificationTemplatePreviewRecord = z.infer<
  typeof notificationTemplatePreviewRecordSchema
>

export const notificationTemplateListResponse = paginatedEnvelope(notificationTemplateRecordSchema)
export const notificationTemplateSingleResponse = singleEnvelope(notificationTemplateRecordSchema)
export const notificationDeliveryListResponse = paginatedEnvelope(notificationDeliveryRecordSchema)
export const notificationDeliverySingleResponse = singleEnvelope(notificationDeliveryRecordSchema)
export const notificationReminderRuleListResponse = paginatedEnvelope(
  notificationReminderRuleRecordSchema,
)
export const notificationReminderRuleSingleResponse = singleEnvelope(
  notificationReminderRuleRecordSchema,
)
export const notificationReminderRunListResponse = z.object({
  data: z.array(notificationReminderRunRecordSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})
export const notificationReminderRunSingleResponse = singleEnvelope(
  notificationReminderRunRecordSchema,
)
export const notificationTemplatePreviewResponse = singleEnvelope(
  notificationTemplatePreviewRecordSchema,
)

export const notificationProviderOptionSchema = z.enum(["automatic", "resend", "twilio"])
export const notificationTemplateEditorChannelSchema = notificationChannelSchema
export const notificationReminderRuleStatusFilterSchema = notificationReminderStatusSchema
export const notificationReminderRunStatusFilterSchema = notificationReminderRunStatusSchema

export const reminderStageAnchorSchema = z.enum([
  "due_date",
  "booking_created_at",
  "departure_date",
  "invoice_issued_at",
  "last_send_at",
])
export const reminderStageCadenceKindSchema = z.enum(["once", "every_n_days", "escalating"])
export const reminderStageRecipientKindSchema = z.enum(["primary", "cc", "bcc"])

export const reminderStageCadenceIntervalRecord = z.object({
  whenDaysUntilDueGT: z.number().int().nullable().optional(),
  whenDaysUntilDueLT: z.number().int().nullable().optional(),
  repeatEveryDays: z.number().int(),
})

export const reminderRuleStageRecordSchema = z.object({
  id: z.string(),
  reminderRuleId: z.string(),
  orderIndex: z.number().int(),
  name: z.string().nullable(),
  anchor: reminderStageAnchorSchema,
  windowStartDays: z.number().int(),
  windowEndDays: z.number().int(),
  cadenceKind: reminderStageCadenceKindSchema,
  cadenceEveryDays: z.number().int().nullable(),
  cadenceIntervals: z.array(reminderStageCadenceIntervalRecord).nullable(),
  maxSendsInStage: z.number().int().nullable(),
  respectQuietHours: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ReminderRuleStageRecord = z.infer<typeof reminderRuleStageRecordSchema>

export const reminderStageChannelRecordSchema = z.object({
  id: z.string(),
  stageId: z.string(),
  orderIndex: z.number().int(),
  channel: notificationChannelSchema,
  provider: z.string().nullable(),
  templateId: z.string().nullable(),
  templateSlug: z.string().nullable(),
  recipientKind: reminderStageRecipientKindSchema,
  recipientRole: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ReminderStageChannelRecord = z.infer<typeof reminderStageChannelRecordSchema>

export const notificationQuietHoursConfigSchema = z.object({
  start: z.string(),
  end: z.string(),
  tz: z.string(),
})

export const notificationSettingsRecordSchema = z.object({
  id: z.string(),
  scope: z.string(),
  quietHoursLocal: notificationQuietHoursConfigSchema.nullable(),
  blackoutDates: z.array(z.string()).nullable(),
  skipWeekends: z.boolean(),
  holidayCalendar: z.string().nullable(),
  recipientRateLimitPerDay: z.number().int().nullable(),
  suppressionWindowHours: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type NotificationSettingsRecord = z.infer<typeof notificationSettingsRecordSchema>

export const remindersPreviewRowSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  ruleSlug: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  bookingId: z.string().nullable(),
  stageId: z.string(),
  stageName: z.string().nullable(),
  stageOrderIndex: z.number().int(),
  anchor: z.string(),
  anchorDate: z.string(),
  scheduledAt: z.string(),
  sendCountAtFire: z.number().int(),
  reasoning: z.string(),
})

export type RemindersPreviewRow = z.infer<typeof remindersPreviewRowSchema>

export const reminderRuleStagesListResponse = singleEnvelope(z.array(reminderRuleStageRecordSchema))
export const reminderRuleStageSingleResponse = singleEnvelope(reminderRuleStageRecordSchema)
export const reminderStageChannelsListResponse = singleEnvelope(
  z.array(reminderStageChannelRecordSchema),
)
export const reminderStageChannelSingleResponse = singleEnvelope(reminderStageChannelRecordSchema)
export const notificationSettingsResponse = singleEnvelope(notificationSettingsRecordSchema)
export const remindersPreviewResponse = singleEnvelope(z.array(remindersPreviewRowSchema))
