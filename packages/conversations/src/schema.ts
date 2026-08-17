import type { Module } from "@voyant-travel/core"
import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const conversationStatusEnum = pgEnum("conversation_status", ["open", "closed", "snoozed"])
export const conversationPartDirectionEnum = pgEnum("conversation_part_direction", [
  "inbound",
  "outbound",
])
export const conversationPartDeliveryStatusEnum = pgEnum("conversation_part_delivery_status", [
  "received",
  "pending",
  "accepted",
  "delivered",
  "failed",
  "bounced",
  "complained",
  "suppressed",
  "cancelled",
])
export const conversationParticipantRoleEnum = pgEnum("conversation_participant_role", [
  "customer",
  "staff",
])
export const conversationIngressStatusEnum = pgEnum("conversation_ingress_status", [
  "committed",
  "drifted",
])

export const conversations = pgTable(
  "conversations",
  {
    id: typeId("conversations"),
    channel: text("channel").notNull().default("email"),
    status: conversationStatusEnum("status").notNull().default("open"),
    subject: text("subject"),
    suggestedSubject: text("suggested_subject"),
    replyAlias: text("reply_alias").notNull(),
    customerAddress: text("customer_address").notNull(),
    personRef: text("person_ref"),
    contactPointRef: text("contact_point_ref"),
    startIdempotencyKey: text("start_idempotency_key"),
    startPayloadFingerprint: text("start_payload_fingerprint"),
    unreadCount: integer("unread_count").notNull().default(0),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    lastPartAt: timestamp("last_part_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_conversations_reply_alias").on(table.replyAlias),
    uniqueIndex("uidx_conversations_start_idempotency").on(table.startIdempotencyKey),
    index("idx_conversations_last_part").on(table.lastPartAt),
    index("idx_conversations_person").on(table.personRef),
  ],
)

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: typeId("conversation_participants"),
    conversationId: typeIdRef("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: conversationParticipantRoleEnum("role").notNull(),
    address: text("address").notNull(),
    personRef: text("person_ref"),
    contactPointRef: text("contact_point_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_conversation_participant_address").on(
      table.conversationId,
      table.role,
      table.address,
    ),
  ],
)

export const conversationParts = pgTable(
  "conversation_parts",
  {
    id: typeId("conversation_parts"),
    conversationId: typeIdRef("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: conversationPartDirectionEnum("direction").notNull(),
    senderAddress: text("sender_address").notNull(),
    recipientAddresses: jsonb("recipient_addresses").$type<string[]>().notNull().default([]),
    subject: text("subject"),
    textBody: text("text_body"),
    htmlBody: text("html_body"),
    attachments: jsonb("attachments")
      .$type<readonly Record<string, unknown>[]>()
      .notNull()
      .default([]),
    externalSourceId: text("external_source_id"),
    externalMessageId: text("external_message_id"),
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    references: jsonb("references").$type<string[]>().notNull().default([]),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    notificationDeliveryId: text("notification_delivery_id"),
    idempotencyKey: text("idempotency_key"),
    deliveryStatus: conversationPartDeliveryStatusEnum("delivery_status").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_conversation_parts_external_message").on(
      table.externalSourceId,
      table.externalMessageId,
    ),
    uniqueIndex("uidx_conversation_parts_message_id").on(table.messageId),
    uniqueIndex("uidx_conversation_parts_idempotency").on(table.idempotencyKey),
    index("idx_conversation_parts_conversation_occurred").on(
      table.conversationId,
      table.occurredAt,
    ),
  ],
)

export const conversationEvents = pgTable(
  "conversation_events",
  {
    id: typeId("conversation_events"),
    conversationId: typeIdRef("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_conversation_events_conversation").on(table.conversationId, table.occurredAt),
  ],
)

export const conversationIngressOperations = pgTable(
  "conversation_ingress_operations",
  {
    id: typeId("conversation_ingress_operations"),
    sourceId: text("source_id").notNull(),
    externalEnvelopeId: text("external_envelope_id").notNull(),
    externalMessageId: text("external_message_id").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    conversationPartId: typeIdRef("conversation_part_id").references(() => conversationParts.id, {
      onDelete: "restrict",
    }),
    status: conversationIngressStatusEnum("status").notNull().default("committed"),
    error: text("error"),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_conversation_ingress_envelope").on(table.sourceId, table.externalEnvelopeId),
    uniqueIndex("uidx_conversation_ingress_message").on(table.sourceId, table.externalMessageId),
  ],
)

export type Conversation = typeof conversations.$inferSelect
export type ConversationPart = typeof conversationParts.$inferSelect

export const conversationsModule: Module = { name: "conversations", requiresTransactionalDb: true }
