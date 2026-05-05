import type { LinkableDefinition, Module } from "@voyantjs/core"
import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import type { HonoModule } from "@voyantjs/hono/module"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const notificationChannelEnum = pgEnum("notification_channel", ["email", "sms"])

export const notificationTemplateStatusEnum = pgEnum("notification_template_status", [
  "draft",
  "active",
  "archived",
])

export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
])

export const notificationTargetTypeEnum = pgEnum("notification_target_type", [
  "booking",
  "booking_payment_schedule",
  "booking_guarantee",
  "invoice",
  "payment_session",
  "person",
  "organization",
  "other",
])

export const notificationReminderStatusEnum = pgEnum("notification_reminder_status", [
  "draft",
  "active",
  "archived",
])

export const notificationReminderTargetTypeEnum = pgEnum("notification_reminder_target_type", [
  "booking_confirmed",
  "booking_payment_schedule",
  "payment_complete",
  "booking_cancelled_non_payment",
  "invoice",
])

export const notificationReminderRunStatusEnum = pgEnum("notification_reminder_run_status", [
  "queued",
  "processing",
  "sent",
  "skipped",
  "failed",
])

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: typeId("notification_templates"),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    provider: text("provider"),
    status: notificationTemplateStatusEnum("status").notNull().default("draft"),
    subjectTemplate: text("subject_template"),
    htmlTemplate: text("html_template"),
    textTemplate: text("text_template"),
    fromAddress: text("from_address"),
    isSystem: boolean("is_system").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notification_templates_updated").on(table.updatedAt),
    index("idx_notification_templates_channel_updated").on(table.channel, table.updatedAt),
    index("idx_notification_templates_provider_updated").on(table.provider, table.updatedAt),
    index("idx_notification_templates_status_updated").on(table.status, table.updatedAt),
    uniqueIndex("uidx_notification_templates_slug").on(table.slug),
  ],
)

export type NotificationTemplate = typeof notificationTemplates.$inferSelect
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: typeId("notification_deliveries"),
    templateId: typeIdRef("template_id").references(() => notificationTemplates.id, {
      onDelete: "set null",
    }),
    templateSlug: text("template_slug"),
    targetType: notificationTargetTypeEnum("target_type").notNull().default("other"),
    targetId: text("target_id"),
    personId: text("person_id"),
    organizationId: text("organization_id"),
    bookingId: text("booking_id"),
    invoiceId: text("invoice_id"),
    paymentSessionId: text("payment_session_id"),
    channel: notificationChannelEnum("channel").notNull(),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: notificationDeliveryStatusEnum("status").notNull().default("pending"),
    toAddress: text("to_address").notNull(),
    fromAddress: text("from_address"),
    subject: text("subject"),
    htmlBody: text("html_body"),
    textBody: text("text_body"),
    payloadData: jsonb("payload_data").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notification_deliveries_created").on(table.createdAt),
    index("idx_notification_deliveries_template_created").on(table.templateId, table.createdAt),
    index("idx_notification_deliveries_target_created").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index("idx_notification_deliveries_person_created").on(table.personId, table.createdAt),
    index("idx_notification_deliveries_org_created").on(table.organizationId, table.createdAt),
    index("idx_notification_deliveries_booking_created").on(table.bookingId, table.createdAt),
    index("idx_notification_deliveries_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_notification_deliveries_payment_session_created").on(
      table.paymentSessionId,
      table.createdAt,
    ),
    index("idx_notification_deliveries_channel_created").on(table.channel, table.createdAt),
    index("idx_notification_deliveries_provider_created").on(table.provider, table.createdAt),
    index("idx_notification_deliveries_status_created").on(table.status, table.createdAt),
    index("idx_notification_deliveries_scheduled_for").on(table.scheduledFor),
  ],
)

export type NotificationDelivery = typeof notificationDeliveries.$inferSelect
export type NewNotificationDelivery = typeof notificationDeliveries.$inferInsert

export const notificationReminderRules = pgTable(
  "notification_reminder_rules",
  {
    id: typeId("notification_reminder_rules"),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    status: notificationReminderStatusEnum("status").notNull().default("draft"),
    targetType: notificationReminderTargetTypeEnum("target_type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    provider: text("provider"),
    templateId: typeIdRef("template_id").references(() => notificationTemplates.id, {
      onDelete: "set null",
    }),
    templateSlug: text("template_slug"),
    relativeDaysFromDueDate: integer("relative_days_from_due_date").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notification_reminder_rules_updated").on(table.updatedAt),
    index("idx_notification_reminder_rules_status_updated").on(table.status, table.updatedAt),
    index("idx_notification_reminder_rules_target_updated").on(table.targetType, table.updatedAt),
    index("idx_notification_reminder_rules_channel_updated").on(table.channel, table.updatedAt),
    uniqueIndex("uidx_notification_reminder_rules_slug").on(table.slug),
  ],
)

export type NotificationReminderRule = typeof notificationReminderRules.$inferSelect
export type NewNotificationReminderRule = typeof notificationReminderRules.$inferInsert

export const notificationReminderRuns = pgTable(
  "notification_reminder_runs",
  {
    id: typeId("notification_reminder_runs"),
    reminderRuleId: typeIdRef("reminder_rule_id")
      .notNull()
      .references(() => notificationReminderRules.id, { onDelete: "cascade" }),
    targetType: notificationReminderTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    bookingId: text("booking_id"),
    personId: text("person_id"),
    organizationId: text("organization_id"),
    paymentSessionId: text("payment_session_id"),
    notificationDeliveryId: typeIdRef("notification_delivery_id").references(
      () => notificationDeliveries.id,
      { onDelete: "set null" },
    ),
    status: notificationReminderRunStatusEnum("status").notNull(),
    recipient: text("recipient"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notification_reminder_runs_created").on(table.createdAt),
    index("idx_notification_reminder_runs_rule_created").on(table.reminderRuleId, table.createdAt),
    index("idx_notification_reminder_runs_target_created").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index("idx_notification_reminder_runs_booking_created").on(table.bookingId, table.createdAt),
    index("idx_notification_reminder_runs_payment_session_created").on(
      table.paymentSessionId,
      table.createdAt,
    ),
    index("idx_notification_reminder_runs_delivery_created").on(
      table.notificationDeliveryId,
      table.createdAt,
    ),
    index("idx_notification_reminder_runs_person_created").on(table.personId, table.createdAt),
    index("idx_notification_reminder_runs_org_created").on(table.organizationId, table.createdAt),
    index("idx_notification_reminder_runs_recipient_created").on(table.recipient, table.createdAt),
    index("idx_notification_reminder_runs_status_created").on(table.status, table.createdAt),
    uniqueIndex("uidx_notification_reminder_runs_dedupe").on(table.dedupeKey),
  ],
)

export type NotificationReminderRun = typeof notificationReminderRuns.$inferSelect
export type NewNotificationReminderRun = typeof notificationReminderRuns.$inferInsert

export const notificationTemplatesRelations = relations(notificationTemplates, ({ many }) => ({
  deliveries: many(notificationDeliveries),
  reminderRules: many(notificationReminderRules),
}))

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
  template: one(notificationTemplates, {
    fields: [notificationDeliveries.templateId],
    references: [notificationTemplates.id],
  }),
}))

export const notificationReminderRulesRelations = relations(
  notificationReminderRules,
  ({ many, one }) => ({
    template: one(notificationTemplates, {
      fields: [notificationReminderRules.templateId],
      references: [notificationTemplates.id],
    }),
    runs: many(notificationReminderRuns),
  }),
)

export const notificationReminderRunsRelations = relations(notificationReminderRuns, ({ one }) => ({
  reminderRule: one(notificationReminderRules, {
    fields: [notificationReminderRuns.reminderRuleId],
    references: [notificationReminderRules.id],
  }),
  notificationDelivery: one(notificationDeliveries, {
    fields: [notificationReminderRuns.notificationDeliveryId],
    references: [notificationDeliveries.id],
  }),
}))

export const notificationTemplateLinkable: LinkableDefinition = {
  module: "notifications",
  entity: "notificationTemplate",
  table: "notification_templates",
  idPrefix: "ntpl",
}

export const notificationDeliveryLinkable: LinkableDefinition = {
  module: "notifications",
  entity: "notificationDelivery",
  table: "notification_deliveries",
  idPrefix: "ntdl",
}

export const notificationReminderRuleLinkable: LinkableDefinition = {
  module: "notifications",
  entity: "notificationReminderRule",
  table: "notification_reminder_rules",
  idPrefix: "ntrl",
}

export const notificationReminderRunLinkable: LinkableDefinition = {
  module: "notifications",
  entity: "notificationReminderRun",
  table: "notification_reminder_runs",
  idPrefix: "ntrn",
}

export const notificationsLinkable = {
  notificationTemplate: notificationTemplateLinkable,
  notificationDelivery: notificationDeliveryLinkable,
  notificationReminderRule: notificationReminderRuleLinkable,
  notificationReminderRun: notificationReminderRunLinkable,
}

export const notificationsModule: Module = {
  name: "notifications",
  linkable: notificationsLinkable,
}

// Created in index.ts once routes are available.
export type NotificationsHonoModule = HonoModule
