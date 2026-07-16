import { typeId } from "@voyant-travel/db/lib/typeid-column"
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
    uniqueIndex("uidx_custom_field_definitions_key").on(table.entityType, table.key),
  ],
)
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect
export type NewCustomFieldDefinition = typeof customFieldDefinitions.$inferInsert
