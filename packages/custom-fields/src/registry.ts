import {
  type CustomFieldDefinition,
  type CustomFieldRegistry,
  type CustomFieldType,
  createCustomFieldRegistry,
} from "@voyant-travel/core/custom-fields"
import { eq } from "drizzle-orm"
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

export function customFieldDefinitionFromRow(
  row: typeof customFieldDefinitions.$inferSelect,
  target?: CustomFieldTarget,
): CustomFieldDefinition | null {
  if (row.lifecycleState !== "active") return null
  if (target && !target.fieldTypes.includes(row.fieldType)) return null
  const visibility = target ? normalizeCustomFieldVisibility(target, row) : row
  return {
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
  }
}

function definitionsFromRows(
  rows: readonly (typeof customFieldDefinitions.$inferSelect)[],
  targets?: ReadonlyMap<string, CustomFieldTarget>,
): CustomFieldDefinition[] {
  return rows.flatMap((row) => {
    const target = targets?.get(row.entityType)
    if (targets && !target) return []
    const definition = customFieldDefinitionFromRow(row, target)
    return definition ? [definition] : []
  })
}

export async function loadCustomFieldDefinitions(
  db: PostgresJsDatabase,
  targets?: ReadonlyMap<string, CustomFieldTarget>,
): Promise<CustomFieldDefinition[]> {
  return definitionsFromRows(await db.select().from(customFieldDefinitions), targets)
}

export async function loadCustomFieldRegistry(
  db: PostgresJsDatabase,
  targets?: ReadonlyMap<string, CustomFieldTarget>,
): Promise<CustomFieldRegistry> {
  return createCustomFieldRegistry(await loadCustomFieldDefinitions(db, targets))
}

export async function loadCustomFieldRegistryForWrite(
  db: PostgresJsDatabase,
  entity: string,
  targets?: ReadonlyMap<string, CustomFieldTarget>,
): Promise<CustomFieldRegistry> {
  const rows = await db
    .select()
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entityType, entity))
    .for("share")
  return createCustomFieldRegistry(definitionsFromRows(rows, targets))
}
