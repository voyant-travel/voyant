import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  notificationDeliveries,
  notificationReminderRuleStages,
  notificationReminderRules,
  notificationReminderStageChannels,
  notificationSettings,
  notificationTemplates,
} from "../../src/schema.js"
import {
  notificationChannelSchema,
  notificationDeliveryStatusSchema,
  notificationReminderRunRecordSchema,
  notificationReminderStageAnchorSchema,
  notificationReminderStageCadenceIntervalSchema,
  notificationReminderStageCadenceKindSchema,
  notificationReminderStatusSchema,
  notificationReminderTargetTypeSchema,
  notificationStageRecipientKindSchema,
  notificationTargetTypeSchema,
  notificationTemplateStatusSchema,
} from "../../src/validation.js"

/**
 * Response contract tests (voyant#2114) for the notifications admin routes. Each
 * table-backed fixture is typed as the real Drizzle `$inferSelect` row so column
 * drift breaks compilation; the JSON round-trip (Date → ISO string) mirrors
 * `c.json` so a declared/actual mismatch breaks the test. The schemas below
 * mirror the response shapes declared in `src/routes.ts` (§17 dates → strings).
 * The reminder-run list reuses the exported joined `notificationReminderRunRecordSchema`.
 */

const isoTimestamp = z.string()
const jsonMetadata = z.record(z.string(), z.unknown())

const notificationTemplateSchema = z.object({
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
  metadata: jsonMetadata.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const notificationDeliverySchema = z.object({
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
  payloadData: jsonMetadata.nullable(),
  metadata: jsonMetadata.nullable(),
  errorMessage: z.string().nullable(),
  scheduledFor: isoTimestamp.nullable(),
  sentAt: isoTimestamp.nullable(),
  failedAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const notificationReminderRuleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: notificationReminderStatusSchema,
  targetType: notificationReminderTargetTypeSchema,
  channel: notificationChannelSchema,
  provider: z.string().nullable(),
  templateId: z.string().nullable(),
  templateSlug: z.string().nullable(),
  priority: z.number().int(),
  suppressionGroup: z.string().nullable(),
  isSystem: z.boolean(),
  metadata: jsonMetadata.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const notificationReminderRuleStageSchema = z.object({
  id: z.string(),
  reminderRuleId: z.string(),
  orderIndex: z.number().int(),
  name: z.string().nullable(),
  anchor: notificationReminderStageAnchorSchema,
  windowStartDays: z.number().int(),
  windowEndDays: z.number().int(),
  cadenceKind: notificationReminderStageCadenceKindSchema,
  cadenceEveryDays: z.number().int().nullable(),
  cadenceIntervals: z.array(notificationReminderStageCadenceIntervalSchema).nullable(),
  maxSendsInStage: z.number().int().nullable(),
  respectQuietHours: z.boolean(),
  metadata: jsonMetadata.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const notificationReminderStageChannelSchema = z.object({
  id: z.string(),
  stageId: z.string(),
  orderIndex: z.number().int(),
  channel: notificationChannelSchema,
  provider: z.string().nullable(),
  templateId: z.string().nullable(),
  templateSlug: z.string().nullable(),
  recipientKind: notificationStageRecipientKindSchema,
  recipientRole: z.string().nullable(),
  metadata: jsonMetadata.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const notificationSettingsSchema = z.object({
  id: z.string(),
  scope: z.string(),
  quietHoursLocal: z.object({ start: z.string(), end: z.string(), tz: z.string() }).nullable(),
  blackoutDates: z.array(z.string()).nullable(),
  skipWeekends: z.boolean(),
  recipientRateLimitPerDay: z.number().int().nullable(),
  suppressionWindowHours: z.number().int(),
  metadata: jsonMetadata.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const templateRow: InferSelectModel<typeof notificationTemplates> = {
  id: "notification_templates_0000000000000000",
  slug: "booking-confirmed",
  name: "Booking Confirmed",
  channel: "email",
  provider: "resend",
  status: "active",
  subjectTemplate: "Your booking is confirmed",
  htmlTemplate: "<p>Hi</p>",
  textTemplate: null,
  fromAddress: "hello@example.com",
  isSystem: false,
  metadata: { category: "transactional" },
  createdAt,
  updatedAt,
}

const deliveryRow: InferSelectModel<typeof notificationDeliveries> = {
  id: "notification_deliveries_00000000000000",
  templateId: "notification_templates_0000000000000000",
  templateSlug: "booking-confirmed",
  targetType: "booking",
  targetId: "bookings_000000000000000000000000000",
  personId: null,
  organizationId: null,
  bookingId: "bookings_000000000000000000000000000",
  invoiceId: null,
  paymentSessionId: null,
  channel: "email",
  provider: "resend",
  providerMessageId: "msg_123",
  status: "sent",
  toAddress: "traveler@example.com",
  fromAddress: "hello@example.com",
  subject: "Your booking is confirmed",
  htmlBody: "<p>Hi</p>",
  textBody: null,
  payloadData: { foo: "bar" },
  metadata: null,
  errorMessage: null,
  scheduledFor: null,
  sentAt: createdAt,
  failedAt: null,
  createdAt,
  updatedAt,
}

const reminderRuleRow: InferSelectModel<typeof notificationReminderRules> = {
  id: "notification_reminder_rules_00000000000",
  slug: "payment-due-soon",
  name: "Payment due soon",
  status: "active",
  targetType: "booking_payment_schedule",
  channel: "email",
  provider: null,
  templateId: null,
  templateSlug: "payment-reminder",
  priority: 10,
  suppressionGroup: null,
  isSystem: false,
  metadata: null,
  createdAt,
  updatedAt,
}

const reminderStageRow: InferSelectModel<typeof notificationReminderRuleStages> = {
  id: "notification_reminder_rule_stages_00000",
  reminderRuleId: "notification_reminder_rules_00000000000",
  orderIndex: 0,
  name: "First nudge",
  anchor: "due_date",
  windowStartDays: -7,
  windowEndDays: 0,
  cadenceKind: "every_n_days",
  cadenceEveryDays: 3,
  cadenceIntervals: null,
  maxSendsInStage: 2,
  respectQuietHours: true,
  metadata: null,
  createdAt,
  updatedAt,
}

const stageChannelRow: InferSelectModel<typeof notificationReminderStageChannels> = {
  id: "notification_reminder_stage_channels_00",
  stageId: "notification_reminder_rule_stages_00000",
  orderIndex: 0,
  channel: "email",
  provider: null,
  templateId: null,
  templateSlug: "payment-reminder",
  recipientKind: "primary",
  recipientRole: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const settingsRow: InferSelectModel<typeof notificationSettings> = {
  id: "notification_settings_000000000000000000",
  scope: "default",
  quietHoursLocal: { start: "22:00", end: "08:00", tz: "Europe/Bucharest" },
  blackoutDates: ["2026-12-25"],
  skipWeekends: true,
  recipientRateLimitPerDay: 5,
  suppressionWindowHours: 24,
  metadata: null,
  createdAt,
  updatedAt,
}

// The reminder-run list rows are the service-normalized joined record (rule +
// delivery summaries), already serialized to ISO strings by the service.
const reminderRunRecord = {
  id: "notification_reminder_runs_000000000000",
  reminderRuleId: "notification_reminder_rules_00000000000",
  targetType: "booking_payment_schedule" as const,
  targetId: "booking_payment_schedules_0000000000000",
  dedupeKey: "rule:target:stage:0",
  status: "sent" as const,
  recipient: "traveler@example.com",
  scheduledFor: createdAt.toISOString(),
  processedAt: createdAt.toISOString(),
  errorMessage: null,
  metadata: null,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
  links: {
    bookingId: "bookings_000000000000000000000000000",
    bookingPaymentScheduleId: "booking_payment_schedules_0000000000000",
    invoiceId: null,
    paymentSessionId: null,
    personId: null,
    organizationId: null,
    notificationDeliveryId: "notification_deliveries_00000000000000",
  },
  reminderRule: {
    id: "notification_reminder_rules_00000000000",
    slug: "payment-due-soon",
    name: "Payment due soon",
    status: "active" as const,
    targetType: "booking_payment_schedule" as const,
    channel: "email" as const,
    provider: null,
    templateId: null,
    templateSlug: "payment-reminder",
  },
  delivery: {
    id: "notification_deliveries_00000000000000",
    status: "sent" as const,
    channel: "email" as const,
    provider: "resend",
    toAddress: "traveler@example.com",
    subject: "Payment reminder",
    sentAt: createdAt.toISOString(),
    failedAt: null,
    errorMessage: null,
  },
}

const listCases = [
  ["notification template", notificationTemplateSchema, templateRow],
  ["notification delivery", notificationDeliverySchema, deliveryRow],
  ["notification reminder rule", notificationReminderRuleSchema, reminderRuleRow],
  ["notification reminder run", notificationReminderRunRecordSchema, reminderRunRecord],
] as const

const singleCases = [
  ["notification template", notificationTemplateSchema, templateRow],
  ["notification delivery", notificationDeliverySchema, deliveryRow],
  ["notification reminder rule", notificationReminderRuleSchema, reminderRuleRow],
  ["notification reminder rule stage", notificationReminderRuleStageSchema, reminderStageRow],
  ["notification reminder stage channel", notificationReminderStageChannelSchema, stageChannelRow],
  ["notification settings", notificationSettingsSchema, settingsRow],
  ["notification reminder run", notificationReminderRunRecordSchema, reminderRunRecord],
] as const

describe("notifications list response contracts", () => {
  for (const [label, schema, row] of listCases) {
    it(`the serialized ${label} list satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(
        JSON.stringify(listResponse([row], { total: 1, limit: 20, offset: 0 })),
      )
      const parsed = listResponseSchema(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("notifications single-entity response contracts", () => {
  for (const [label, schema, row] of singleCases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the stages { data } array envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [reminderStageRow] }))
    const parsed = z.object({ data: z.array(notificationReminderRuleStageSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the stage-channels { data } array envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [stageChannelRow] }))
    const parsed = z
      .object({ data: z.array(notificationReminderStageChannelSchema) })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
