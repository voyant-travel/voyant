import { typeId } from "@voyantjs/db/lib/typeid-column"
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const externalRefStatusEnum = pgEnum("external_ref_status", [
  "active",
  "inactive",
  "archived",
])

export const externalRefs = pgTable(
  "external_refs",
  {
    id: typeId("external_refs"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    sourceSystem: text("source_system").notNull(),
    objectType: text("object_type").notNull(),
    namespace: text("namespace").notNull().default("default"),
    externalId: text("external_id").notNull(),
    externalParentId: text("external_parent_id"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: externalRefStatusEnum("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_external_refs_updated").on(table.updatedAt),
    index("idx_external_refs_entity_updated").on(table.entityType, table.entityId, table.updatedAt),
    index("idx_external_refs_source_updated").on(
      table.sourceSystem,
      table.objectType,
      table.updatedAt,
    ),
    index("idx_external_refs_namespace_updated").on(table.namespace, table.updatedAt),
    index("idx_external_refs_external_id").on(table.externalId),
    index("idx_external_refs_status_updated").on(table.status, table.updatedAt),
    uniqueIndex("uidx_external_refs_entity_source_external").on(
      table.entityType,
      table.entityId,
      table.sourceSystem,
      table.namespace,
      table.externalId,
    ),
    uniqueIndex("uidx_external_refs_source_object_external").on(
      table.sourceSystem,
      table.objectType,
      table.namespace,
      table.externalId,
    ),
  ],
)

export type ExternalRef = typeof externalRefs.$inferSelect
export type NewExternalRef = typeof externalRefs.$inferInsert
