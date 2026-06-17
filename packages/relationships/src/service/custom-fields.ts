import { eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { customFieldDefinitions } from "../schema.js"
import type {
  customFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema,
  insertCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
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
import { paginate } from "./helpers.js"

type CustomFieldDefinitionListQuery = z.infer<typeof customFieldDefinitionListQuerySchema>
type CreateCustomFieldDefinitionInput = z.infer<typeof insertCustomFieldDefinitionSchema>
type UpdateCustomFieldDefinitionInput = z.infer<typeof updateCustomFieldDefinitionSchema>
type CustomFieldValueListQuery = z.infer<typeof customFieldValueListQuerySchema>
type UpsertCustomFieldValueInput = z.infer<typeof upsertCustomFieldValueSchema>

export const customFieldsService = {
  async listCustomFieldDefinitions(db: PostgresJsDatabase, query: CustomFieldDefinitionListQuery) {
    const where = query.entityType
      ? eq(customFieldDefinitions.entityType, query.entityType)
      : undefined
    return paginate(
      db
        .select()
        .from(customFieldDefinitions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(customFieldDefinitions.entityType, customFieldDefinitions.label),
      db.select({ count: sql<number>`count(*)::int` }).from(customFieldDefinitions).where(where),
      query.limit,
      query.offset,
    )
  },

  async getCustomFieldDefinitionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.id, id))
      .limit(1)
    return row ?? null
  },

  async createCustomFieldDefinition(
    db: PostgresJsDatabase,
    data: CreateCustomFieldDefinitionInput,
  ) {
    const [row] = await db.insert(customFieldDefinitions).values(data).returning()
    return row
  },

  async updateCustomFieldDefinition(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateCustomFieldDefinitionInput,
  ) {
    const [existing] = await db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.id, id))
      .limit(1)
    if (!existing) return null

    const [row] = await db
      .update(customFieldDefinitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customFieldDefinitions.id, id))
      .returning()

    // Values live under the definition's `key` in each entity row's
    // `custom_fields` jsonb. Renaming the key would orphan every stored value
    // (invisible to listing/search/export), so migrate the JSON keys in lockstep.
    if (row && data.key && data.key !== existing.key) {
      const table = entityTableName(existing.entityType)
      if (table) {
        const oldKey = existing.key
        const newKey = data.key
        await db.execute(
          sql`UPDATE ${sql.identifier(table)}
              SET custom_fields =
                    (custom_fields - ${oldKey})
                    || jsonb_build_object(${newKey}::text, custom_fields -> ${oldKey}),
                  updated_at = now()
              WHERE custom_fields ? ${oldKey}`,
        )
      }
    }

    return row ?? null
  },

  async deleteCustomFieldDefinition(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(customFieldDefinitions)
      .where(eq(customFieldDefinitions.id, id))
      .returning({ id: customFieldDefinitions.id })
    return row ?? null
  },

  // ---- Values: unified storage on the entity's `custom_fields` jsonb column ----
  // (custom_field_values is retired — see the custom-fields unification ADR.)

  async listCustomFieldValues(db: PostgresJsDatabase, query: CustomFieldValueListQuery) {
    // Locating the value requires the entity type (→ table). The admin UI always
    // scopes by entityType; without one there is nothing to list.
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
      .where(eq(customFieldDefinitions.entityType, query.entityType))
    const defByKey = new Map(defs.map((d) => [d.key, d]))

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
    for (const ent of entities) {
      for (const [key, value] of Object.entries(ent.custom_fields ?? {})) {
        const def = defByKey.get(key)
        if (!def) continue // orphaned key (definition deleted) — skip
        if (query.definitionId && def.id !== query.definitionId) continue
        all.push({
          id: syntheticValueId(query.entityType, ent.id, def.id),
          definitionId: def.id,
          entityType: query.entityType,
          entityId: ent.id,
          ...typedFromJsonbValue(def.fieldType, value),
        })
      }
    }

    return {
      data: all.slice(query.offset, query.offset + query.limit),
      total: all.length,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async upsertCustomFieldValue(
    db: PostgresJsDatabase,
    definitionId: string,
    data: UpsertCustomFieldValueInput,
  ): Promise<CustomFieldValueRow> {
    const [def] = await db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.id, definitionId))
      .limit(1)
    if (!def) {
      throw new Error(`[custom-fields] no definition "${definitionId}"`)
    }
    const table = entityTableName(data.entityType)
    if (!table) {
      throw new Error(
        `[custom-fields] entity type "${data.entityType}" has no custom_fields column`,
      )
    }

    const value = jsonbValueFromTyped(def.fieldType, data)
    const patch = JSON.stringify({ [def.key]: value })
    await db.execute(
      sql`UPDATE ${sql.identifier(table)} SET custom_fields = custom_fields || ${patch}::jsonb, updated_at = now() WHERE id = ${data.entityId}`,
    )

    return {
      id: syntheticValueId(data.entityType, data.entityId, definitionId),
      definitionId,
      entityType: data.entityType,
      entityId: data.entityId,
      ...typedFromJsonbValue(def.fieldType, value),
    }
  },

  async deleteCustomFieldValue(db: PostgresJsDatabase, id: string) {
    const parsed = parseSyntheticValueId(id)
    if (!parsed) return null
    const table = entityTableName(parsed.entityType)
    if (!table) return null
    const [def] = await db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.id, parsed.definitionId))
      .limit(1)
    if (!def) return null
    await db.execute(
      sql`UPDATE ${sql.identifier(table)} SET custom_fields = custom_fields - ${def.key}, updated_at = now() WHERE id = ${parsed.entityId}`,
    )
    return { id }
  },
}

/** A row in the entity table with just its id + custom_fields (raw query shape). */
interface EntityCustomFieldsRow {
  id: string
  custom_fields: Record<string, unknown> | null
}

/** Narrow a raw `db.execute` result into typed `(id, custom_fields)` rows. */
function toEntityCustomFieldsRows(
  result: Iterable<Record<string, unknown>>,
): EntityCustomFieldsRow[] {
  return Array.from(result, (row) => ({
    id: String(row.id),
    custom_fields: (row.custom_fields as Record<string, unknown> | null) ?? null,
  }))
}

/** The value-API row shape, reconstructed from the entity's `custom_fields`. */
type CustomFieldValueRow = {
  id: string
  definitionId: string
  entityType: string
  entityId: string
} & TypedValueColumns
