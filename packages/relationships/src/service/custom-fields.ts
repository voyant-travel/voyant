import {
  assertCustomFieldDefinitionOwner,
  type CustomFieldDefinitionOwner,
  operatorCustomFieldDefinitionOwner,
} from "@voyant-travel/custom-fields"
import { customFieldDefinitions } from "@voyant-travel/custom-fields/schema"
import { ApiHttpError, RequestValidationError } from "@voyant-travel/hono"
import { and, eq, isNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import type {
  customFieldValueListQuerySchema,
  upsertCustomFieldValueSchema,
} from "../validation.js"
import {
  entityTableName,
  jsonbValueFromTyped,
  parseSyntheticValueId,
  syntheticValueId,
  type TypedValueColumns,
  typedFromJsonbValue,
} from "./custom-fields-value-mapping.js"

type CustomFieldValueListQuery = z.infer<typeof customFieldValueListQuerySchema>
type UpsertCustomFieldValueInput = z.infer<typeof upsertCustomFieldValueSchema>

function ownerWhere(owner: CustomFieldDefinitionOwner) {
  return owner.kind === "operator"
    ? and(
        eq(customFieldDefinitions.ownerKind, "operator"),
        eq(customFieldDefinitions.namespace, "custom"),
        isNull(customFieldDefinitions.ownerId),
      )
    : and(
        eq(customFieldDefinitions.ownerKind, owner.kind),
        eq(customFieldDefinitions.namespace, owner.namespace),
        eq(customFieldDefinitions.ownerId, owner.ownerId),
      )
}

async function listCustomFieldValuesForOwner(
  db: PostgresJsDatabase,
  owner: CustomFieldDefinitionOwner,
  query: CustomFieldValueListQuery,
) {
  assertCustomFieldDefinitionOwner(owner)
  const table = query.entityType ? entityTableName(query.entityType) : null
  if (!query.entityType || !table) {
    return {
      data: [] as CustomFieldValueRow[],
      total: 0,
      limit: query.limit,
      offset: query.offset,
    }
  }

  const defs = await db
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.entityType, query.entityType),
        eq(customFieldDefinitions.lifecycleState, "active"),
        ownerWhere(owner),
      ),
    )
  const defByIdentity = new Map(defs.map((definition) => [definition.key, definition]))

  const entities = toEntityCustomFieldsRows(
    query.entityId
      ? await db.execute(
          sql`SELECT id, custom_fields FROM ${sql.identifier(table)} WHERE id = ${query.entityId}`,
        )
      : await db.execute(
          sql`SELECT id, custom_fields FROM ${sql.identifier(table)} WHERE custom_fields <> '{}'::jsonb ORDER BY updated_at DESC`,
        ),
  )

  const all: CustomFieldValueRow[] = []
  for (const entity of entities) {
    const namespaceValues = entity.custom_fields?.[owner.namespace]
    if (!isCustomFieldNamespaceValues(namespaceValues)) continue
    for (const [key, value] of Object.entries(namespaceValues)) {
      const definition = defByIdentity.get(key)
      if (!definition) continue
      if (query.definitionId && definition.id !== query.definitionId) continue
      all.push({
        id: syntheticValueId(query.entityType, entity.id, definition.namespace, definition.id),
        definitionId: definition.id,
        entityType: query.entityType,
        entityId: entity.id,
        namespace: definition.namespace,
        key: definition.key,
        ...typedFromJsonbValue(definition.fieldType, value),
      })
    }
  }

  return {
    data: all.slice(query.offset, query.offset + query.limit),
    total: all.length,
    limit: query.limit,
    offset: query.offset,
  }
}

async function upsertCustomFieldValueForOwner(
  db: PostgresJsDatabase,
  owner: CustomFieldDefinitionOwner,
  definitionId: string,
  data: UpsertCustomFieldValueInput,
): Promise<CustomFieldValueRow> {
  assertCustomFieldDefinitionOwner(owner)
  return db.transaction(async (tx) => {
    const [definition] = await tx
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, definitionId),
          eq(customFieldDefinitions.lifecycleState, "active"),
          ownerWhere(owner),
        ),
      )
      .for("update")
      .limit(1)
    if (!definition) {
      throw new ApiHttpError(`no custom-field definition "${definitionId}"`, {
        status: 404,
        code: "not_found",
      })
    }

    if (data.entityType !== definition.entityType) {
      throw new RequestValidationError(
        `custom field "${definition.key}" belongs to ${definition.entityType}, not ${data.entityType}`,
      )
    }
    const table = entityTableName(definition.entityType)
    if (!table) {
      throw new RequestValidationError(
        `entity type "${definition.entityType}" has no custom_fields column`,
      )
    }

    const value = jsonbValueFromTyped(definition.fieldType, data)
    const updated = Array.from(
      await tx.execute(
        sql`UPDATE ${sql.identifier(table)}
            SET custom_fields = jsonb_set(
                  custom_fields,
                  ARRAY[${definition.namespace}]::text[],
                  COALESCE(custom_fields -> ${definition.namespace}, '{}'::jsonb)
                    || jsonb_build_object(
                      ${definition.key}::text,
                      ${JSON.stringify(value)}::jsonb
                    ),
                  true
                ),
                updated_at = now()
            WHERE id = ${data.entityId}
            RETURNING id`,
      ),
    )
    if (updated.length === 0) {
      throw new ApiHttpError(`${definition.entityType} "${data.entityId}" not found`, {
        status: 404,
        code: "not_found",
      })
    }

    return {
      id: syntheticValueId(
        definition.entityType,
        data.entityId,
        definition.namespace,
        definitionId,
      ),
      definitionId,
      entityType: definition.entityType,
      entityId: data.entityId,
      namespace: definition.namespace,
      key: definition.key,
      ...typedFromJsonbValue(definition.fieldType, value),
    }
  })
}

async function deleteCustomFieldValueForOwner(
  db: PostgresJsDatabase,
  owner: CustomFieldDefinitionOwner,
  id: string,
) {
  assertCustomFieldDefinitionOwner(owner)
  const parsed = parseSyntheticValueId(id)
  if (!parsed || parsed.namespace !== owner.namespace) return null
  const table = entityTableName(parsed.entityType)
  if (!table) return null
  return db.transaction(async (tx) => {
    const [definition] = await tx
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, parsed.definitionId),
          eq(customFieldDefinitions.lifecycleState, "active"),
          ownerWhere(owner),
        ),
      )
      .for("update")
      .limit(1)
    if (!definition) return null
    if (definition.entityType !== parsed.entityType || definition.namespace !== parsed.namespace) {
      return null
    }

    const deleted = Array.from(
      await tx.execute(
        sql`UPDATE ${sql.identifier(table)}
            SET custom_fields = custom_fields #- ARRAY[${definition.namespace}, ${definition.key}]::text[],
                updated_at = now()
            WHERE id = ${parsed.entityId}
              AND custom_fields -> ${definition.namespace} ? ${definition.key}
            RETURNING id`,
      ),
    )
    if (deleted.length === 0) return null
    return { id }
  })
}

export const customFieldsService = {
  listCustomFieldValues(db: PostgresJsDatabase, query: CustomFieldValueListQuery) {
    return listCustomFieldValuesForOwner(db, operatorCustomFieldDefinitionOwner, query)
  },
  upsertCustomFieldValue(
    db: PostgresJsDatabase,
    definitionId: string,
    data: UpsertCustomFieldValueInput,
  ) {
    return upsertCustomFieldValueForOwner(
      db,
      operatorCustomFieldDefinitionOwner,
      definitionId,
      data,
    )
  },
  deleteCustomFieldValue(db: PostgresJsDatabase, id: string) {
    return deleteCustomFieldValueForOwner(db, operatorCustomFieldDefinitionOwner, id)
  },
  listCustomFieldValuesForOwner,
  upsertCustomFieldValueForOwner,
  deleteCustomFieldValueForOwner,
}

interface EntityCustomFieldsRow {
  id: string
  custom_fields: Record<string, unknown> | null
}

function isCustomFieldNamespaceValues(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toEntityCustomFieldsRows(
  result: Iterable<Record<string, unknown>>,
): EntityCustomFieldsRow[] {
  return Array.from(result, (row) => ({
    id: String(row.id),
    custom_fields: (row.custom_fields as Record<string, unknown> | null) ?? null,
  }))
}

type CustomFieldValueRow = {
  id: string
  definitionId: string
  entityType: string
  entityId: string
  namespace: string
  key: string
} & TypedValueColumns
