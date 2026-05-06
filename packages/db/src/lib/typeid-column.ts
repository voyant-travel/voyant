// /packages/db/src/lib/typeid-column.ts
// Drizzle column helpers for TypeID primary keys and foreign keys

import { text, varchar } from "drizzle-orm/pg-core"

import { newId, type PrefixKey } from "./typeid.js"

/**
 * Maximum length of a TypeID string.
 * Format: prefix (2-4 chars) + "_" + suffix (26 chars) = up to 31 chars
 * Using 32 for safety margin.
 */
export const TYPEID_MAX_LENGTH = 32

/**
 * Creates a TypeID primary key column with automatic generation.
 * Use this for root/parent tables where IDs are generated automatically.
 *
 * The column uses `text` type and generates TypeIDs via `$defaultFn`.
 *
 * @param prefix - The entity type key from PREFIXES
 * @param columnName - The database column name (defaults to "id")
 * @returns A Drizzle column definition
 *
 * @example
 * // In a schema file:
 * export const productsTable = pgTable("products", {
 *   id: typeId("products"),
 *   name: text("name").notNull(),
 * });
 */
export function typeId(prefix: PrefixKey, columnName = "id") {
  return text(columnName)
    .primaryKey()
    .$defaultFn(() => newId(prefix))
}

/**
 * Creates a TypeID primary key column WITHOUT automatic generation.
 * Use this for child/linked tables where the ID must be provided explicitly
 * to match a parent record (e.g., a 1:1 table whose PK must match the parent PK).
 *
 * @param columnName - The database column name (defaults to "id")
 * @returns A Drizzle column definition without default
 *
 * @example
 * // For 1:1 relationships where ID must match parent:
 * export const profileTable = pgTable("profiles", {
 *   id: typeIdManual(), // Must be passed explicitly
 *   firstName: text("first_name"),
 * });
 */
export function typeIdManual(columnName = "id") {
  return text(columnName).primaryKey()
}

/**
 * Creates a TypeID foreign key column.
 * Use this for columns that reference another table's TypeID.
 *
 * @param columnName - The database column name
 * @returns A Drizzle column definition for foreign keys
 *
 * @example
 * export const ordersTable = pgTable("orders", {
 *   id: typeId("orders"),
 *   productId: typeIdRef("product_id").notNull().references(() => productsTable.id),
 * });
 */
export function typeIdRef(columnName: string) {
  return text(columnName)
}

/**
 * Creates an optimized TypeID column using varchar with fixed length.
 * Use this when you want to optimize storage (varchar vs text).
 *
 * Note: Most use cases should prefer `typeId()` with text for simplicity.
 * Only use this for high-volume tables where storage optimization matters.
 *
 * @param prefix - The entity type key from PREFIXES
 * @param columnName - The database column name (defaults to "id")
 * @returns A Drizzle column definition with varchar type
 */
export function typeIdOptimized(prefix: PrefixKey, columnName = "id") {
  return varchar(columnName, { length: TYPEID_MAX_LENGTH })
    .primaryKey()
    .$defaultFn(() => newId(prefix))
}

/**
 * Creates an optimized TypeID foreign key column using varchar.
 *
 * @param columnName - The database column name
 * @returns A Drizzle column definition for foreign keys with varchar type
 */
export function typeIdRefOptimized(columnName: string) {
  return varchar(columnName, { length: TYPEID_MAX_LENGTH })
}
