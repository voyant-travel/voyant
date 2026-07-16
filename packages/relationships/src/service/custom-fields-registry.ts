import {
  type CustomFieldDefinition,
  type CustomFieldRegistry,
  type CustomFieldType,
  createCustomFieldRegistry,
} from "@voyant-travel/core/custom-fields"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { customFieldDefinitions } from "../schema.js"

/**
 * Map the runtime `custom_field_type` enum onto the canonical registry type
 * (see the custom-fields unification ADR). `varchar`→`text`, `double`→`number`,
 * `enum`→`select`, `set`→`multiselect`, `address`/`phone`→`json` (structured).
 */
const TYPE_MAP: Record<string, CustomFieldType> = {
  varchar: "text",
  text: "text",
  double: "number",
  monetary: "monetary",
  date: "date",
  boolean: "boolean",
  enum: "select",
  set: "multiselect",
  json: "json",
  address: "json",
  phone: "text",
}

/**
 * Load the deployment's custom fields from the persisted
 * `custom_field_definitions` table. Persisted definitions are the sole runtime
 * authority; compatibility authoring helpers in `@voyant-travel/core` do not
 * participate in registry resolution.
 *
 * Persisted visibility flags map directly onto the shared registry contract.
 */
export async function loadCustomFieldDefinitions(
  db: PostgresJsDatabase,
): Promise<CustomFieldDefinition[]> {
  const rows = await db.select().from(customFieldDefinitions)
  return rows.map((row) => ({
    entity: row.entityType,
    key: row.key,
    type: TYPE_MAP[row.fieldType] ?? "text",
    label: row.label,
    required: row.isRequired,
    options: row.options?.map((option) => option.value),
    visibility: {
      export: row.isExportable,
      invoice: row.isInvoiceable,
      search: row.isSearchable,
    },
  }))
}

/** Resolve the effective runtime registry directly from persisted definitions. */
export async function loadCustomFieldRegistry(
  db: PostgresJsDatabase,
): Promise<CustomFieldRegistry> {
  return createCustomFieldRegistry(await loadCustomFieldDefinitions(db))
}
