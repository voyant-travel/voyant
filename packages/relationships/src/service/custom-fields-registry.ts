import type { CustomFieldDefinition, CustomFieldType } from "@voyant-travel/core/custom-fields"
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
 * Load the deployment's runtime-defined custom fields — the
 * `custom_field_definitions` table (admin-created at runtime) — as registry
 * definitions. This is the DB half of the unified custom-fields system; merge it
 * with the code-declared set via `mergeCustomFieldDefinitions` (code wins), e.g.
 *
 *     createCustomFieldRegistry(
 *       mergeCustomFieldDefinitions([codeFields, await loadCustomFieldDefinitions(db)]),
 *     )
 *
 * `isSearchable` maps to `visibility.search`; export/invoice fall back to the
 * registry defaults (export on, invoice off) until those columns are added.
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
    visibility: { search: row.isSearchable },
  }))
}
