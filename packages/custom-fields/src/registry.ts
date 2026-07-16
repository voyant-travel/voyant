import {
  type CustomFieldDefinition,
  type CustomFieldRegistry,
  type CustomFieldType,
  createCustomFieldRegistry,
} from "@voyant-travel/core/custom-fields"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { customFieldDefinitions } from "./schema.js"
import { normalizeCustomFieldVisibility } from "./target-capabilities.js"
import type { CustomFieldTarget } from "./targets.js"

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

export async function loadCustomFieldDefinitions(
  db: PostgresJsDatabase,
  targets?: ReadonlyMap<string, CustomFieldTarget>,
): Promise<CustomFieldDefinition[]> {
  return (await db.select().from(customFieldDefinitions)).flatMap((row) => {
    if (row.lifecycleState !== "active") return []
    const target = targets?.get(row.entityType)
    if (targets && !target) return []
    if (target && !target.fieldTypes.includes(row.fieldType)) return []
    const visibility = target ? normalizeCustomFieldVisibility(target, row) : row
    return [
      {
        entity: row.entityType,
        namespace: row.namespace,
        key: row.key,
        type: TYPE_MAP[row.fieldType] ?? "text",
        label: row.label,
        required: row.isRequired,
        options: row.options?.map((option) => option.value),
        visibility: {
          export: visibility.isExportable,
          invoice: visibility.isInvoiceable,
          search: visibility.isSearchable,
        },
      },
    ]
  })
}
export async function loadCustomFieldRegistry(
  db: PostgresJsDatabase,
  targets?: ReadonlyMap<string, CustomFieldTarget>,
): Promise<CustomFieldRegistry> {
  return createCustomFieldRegistry(await loadCustomFieldDefinitions(db, targets))
}
