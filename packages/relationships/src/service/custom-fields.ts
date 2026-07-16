import { customFieldDefinitions } from "@voyant-travel/custom-fields/schema"
import { ApiHttpError, RequestValidationError } from "@voyant-travel/hono"
import { eq, sql } from "drizzle-orm"
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

export const customFieldsService = {
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
      throw new ApiHttpError(`no custom-field definition "${definitionId}"`, {
        status: 404,
        code: "not_found",
      })
    }

    // The definition's entityType is authoritative — it decides the physical
    // table. Reject a payload pointing at a different entity type rather than
    // writing e.g. a person field into an organization row, where listing
    // (which loads definitions by the requested entity type) would never
    // surface it again. See the custom-fields unification ADR.
    if (data.entityType !== def.entityType) {
      throw new RequestValidationError(
        `custom field "${def.key}" belongs to ${def.entityType}, not ${data.entityType}`,
      )
    }
    const table = entityTableName(def.entityType)
    if (!table) {
      throw new RequestValidationError(
        `entity type "${def.entityType}" has no custom_fields column`,
      )
    }

    const value = jsonbValueFromTyped(def.fieldType, data)
    const patch = JSON.stringify({ [def.key]: value })
    // RETURNING id lets us distinguish "stored" from "no such entity row" — a
    // bare UPDATE silently affects zero rows, which previously returned a
    // synthetic success for a nonexistent entity id.
    const updated = Array.from(
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET custom_fields = custom_fields || ${patch}::jsonb, updated_at = now() WHERE id = ${data.entityId} RETURNING id`,
      ),
    )
    if (updated.length === 0) {
      throw new ApiHttpError(`${def.entityType} "${data.entityId}" not found`, {
        status: 404,
        code: "not_found",
      })
    }

    return {
      id: syntheticValueId(def.entityType, data.entityId, definitionId),
      definitionId,
      entityType: def.entityType,
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
    // The synthetic id encodes the entity type; if it disagrees with the
    // definition it is forged/stale — treat as not found.
    if (def.entityType !== parsed.entityType) return null
    const deleted = Array.from(
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET custom_fields = custom_fields - ${def.key}, updated_at = now() WHERE id = ${parsed.entityId} AND custom_fields ? ${def.key} RETURNING id`,
      ),
    )
    // No matching entity row, or the value was never set → 404 (not a fake 200).
    if (deleted.length === 0) return null
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
