import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "varchar",
  "text",
  "double",
  "monetary",
  "date",
  "boolean",
  "enum",
  "set",
  "json",
  "address",
  "phone",
])

export const customFieldOwnerKindEnum = pgEnum("custom_field_owner_kind", [
  "platform",
  "operator",
  "app",
])

export const customFieldLifecycleStateEnum = pgEnum("custom_field_lifecycle_state", [
  "active",
  "inactive",
  "deprecated",
])

/**
 * The table was introduced by Relationships migration history.  This generic
 * package is its sole runtime/schema access owner from #3398 onward; it does
 * not replay or mutate that immutable history.
 */
export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: typeId("custom_field_definitions"),
    entityType: text("entity_type").notNull(),
    namespace: text("namespace").notNull(),
    ownerKind: customFieldOwnerKindEnum("owner_kind").notNull(),
    ownerId: text("owner_id"),
    lifecycleState: customFieldLifecycleStateEnum("lifecycle_state").notNull(),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    fieldType: customFieldTypeEnum("field_type").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    isSearchable: boolean("is_searchable").notNull().default(false),
    isExportable: boolean("is_exportable").notNull().default(true),
    isInvoiceable: boolean("is_invoiceable").notNull().default(false),
    options: jsonb("options").$type<Array<{ label: string; value: string }>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_custom_field_definitions_entity").on(table.entityType),
    index("idx_custom_field_definitions_entity_label").on(table.entityType, table.label),
    index("idx_custom_field_definitions_owner").on(
      table.ownerKind,
      table.ownerId,
      table.lifecycleState,
    ),
    index("idx_custom_field_definitions_namespace").on(table.namespace, table.entityType),
    check(
      "custom_field_definitions_owner_identity",
      // agent-quality: raw-sql reviewed -- owner: custom-fields; identifiers are Drizzle-owned columns and all literals are static.
      sql`(
        (${table.ownerKind} = 'operator' AND ${table.ownerId} IS NULL AND ${table.namespace} = 'custom')
        OR (
          ${table.ownerKind} = 'platform'
          AND ${table.ownerId} IS NOT NULL
          AND ${table.namespace} <> 'custom'
          AND ${table.namespace} NOT LIKE 'app--%'
        )
        OR (
          ${table.ownerKind} = 'app'
          AND ${table.ownerId} IS NOT NULL
          AND ${table.namespace} LIKE 'app--%'
        )
      )`,
    ),
    uniqueIndex("uidx_custom_field_definitions_namespace_key").on(
      table.entityType,
      table.namespace,
      table.key,
    ),
  ],
)
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect
export type NewCustomFieldDefinition = typeof customFieldDefinitions.$inferInsert
