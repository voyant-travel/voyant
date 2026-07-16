import type { NamespacedCustomFieldValues } from "@voyant-travel/core/custom-fields"
import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { people } from "./schema-accounts.js"
import {
  activityLinkRoleEnum,
  activityStatusEnum,
  activityTypeEnum,
  entityTypeEnum,
} from "./schema-shared.js"

export const activities = pgTable(
  "activities",
  {
    id: typeId("activities"),
    subject: text("subject").notNull(),
    type: activityTypeEnum("type").notNull(),
    ownerId: text("owner_id"),
    status: activityStatusEnum("status").notNull().default("planned"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    location: text("location"),
    description: text("description"),
    /** Unified custom fields — see the custom-fields unification ADR. */
    customFields: jsonb("custom_fields").$type<NamespacedCustomFieldValues>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_activities_owner").on(table.ownerId),
    index("idx_activities_status").on(table.status),
    index("idx_activities_type").on(table.type),
    index("idx_activities_owner_updated").on(table.ownerId, table.updatedAt),
    index("idx_activities_status_updated").on(table.status, table.updatedAt),
    index("idx_activities_type_updated").on(table.type, table.updatedAt),
  ],
)

export const activityLinks = pgTable(
  "activity_links",
  {
    id: typeId("activity_links"),
    activityId: typeIdRef("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    role: activityLinkRoleEnum("role").notNull().default("related"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_activity_links_activity").on(table.activityId),
    index("idx_activity_links_activity_role").on(table.activityId, table.role, table.createdAt),
    index("idx_activity_links_entity").on(table.entityType, table.entityId),
  ],
)

export const activityParticipants = pgTable(
  "activity_participants",
  {
    id: typeId("activity_participants"),
    activityId: typeIdRef("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_activity_participants_activity").on(table.activityId),
    index("idx_activity_participants_activity_primary").on(
      table.activityId,
      table.isPrimary,
      table.createdAt,
    ),
    uniqueIndex("uidx_activity_participants_unique").on(table.activityId, table.personId),
  ],
)

export type Activity = typeof activities.$inferSelect
export type NewActivity = typeof activities.$inferInsert
export type ActivityLink = typeof activityLinks.$inferSelect
export type NewActivityLink = typeof activityLinks.$inferInsert
export type ActivityParticipant = typeof activityParticipants.$inferSelect
export type NewActivityParticipant = typeof activityParticipants.$inferInsert
