import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  CustomFieldDefinitionInput,
  CustomFieldDefinitionListQuery,
  CustomFieldDefinitionUpdate,
} from "./contracts.js"
import { customFieldDefinitions } from "./schema.js"
import { normalizeCustomFieldVisibility } from "./target-capabilities.js"
import type { CustomFieldTarget } from "./targets.js"

export function createCustomFieldsService(targets: ReadonlyMap<string, CustomFieldTarget>) {
  const targetIds = [...targets.keys()]

  const assertAllowed = (
    target: string,
    fieldType?: CustomFieldDefinitionInput["fieldType"],
  ): CustomFieldTarget => {
    const definition = targets.get(target)
    if (!definition) {
      throw new ApiHttpError(`Unsupported custom-field target "${target}"`, {
        status: 400,
        code: "unsupported_custom_field_target",
      })
    }
    if (fieldType && !definition.fieldTypes.includes(fieldType)) {
      throw new ApiHttpError(`Field type "${fieldType}" is not supported by target "${target}"`, {
        status: 400,
        code: "unsupported_custom_field_type",
      })
    }
    return definition
  }

  const selectedTargetWhere = () =>
    targetIds.length > 0 ? inArray(customFieldDefinitions.entityType, targetIds) : undefined

  const get = async (db: PostgresJsDatabase, id: string) => {
    if (targetIds.length === 0) return null
    const [row] = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, id),
          inArray(customFieldDefinitions.entityType, targetIds),
        ),
      )
      .limit(1)
    return row ?? null
  }

  return {
    async list(db: PostgresJsDatabase, query: CustomFieldDefinitionListQuery) {
      if (query.entityType) assertAllowed(query.entityType)
      if (targetIds.length === 0) {
        return { data: [], total: 0, limit: query.limit, offset: query.offset }
      }
      const where = query.entityType
        ? eq(customFieldDefinitions.entityType, query.entityType)
        : selectedTargetWhere()
      const [data, count] = await Promise.all([
        db
          .select()
          .from(customFieldDefinitions)
          .where(where)
          .limit(query.limit)
          .offset(query.offset)
          .orderBy(customFieldDefinitions.entityType, customFieldDefinitions.label),
        db.select({ count: sql<number>`count(*)::int` }).from(customFieldDefinitions).where(where),
      ])
      return { data, total: count[0]?.count ?? 0, limit: query.limit, offset: query.offset }
    },
    get,
    async create(db: PostgresJsDatabase, input: CustomFieldDefinitionInput) {
      const target = assertAllowed(input.entityType, input.fieldType)
      const [row] = await db
        .insert(customFieldDefinitions)
        .values({ ...input, ...normalizeCustomFieldVisibility(target, input) })
        .onConflictDoNothing({
          target: [customFieldDefinitions.entityType, customFieldDefinitions.key],
        })
        .returning()
      if (!row) {
        throw new ApiHttpError("Custom field key already exists for this target", {
          status: 409,
          code: "duplicate_custom_field_key",
        })
      }
      return row
    },
    async update(db: PostgresJsDatabase, id: string, input: CustomFieldDefinitionUpdate) {
      const existing = await get(db, id)
      if (!existing) return null
      const target = assertAllowed(existing.entityType)
      const [row] = await db
        .update(customFieldDefinitions)
        .set({ ...input, ...normalizeCustomFieldVisibility(target, input), updatedAt: new Date() })
        .where(eq(customFieldDefinitions.id, id))
        .returning()
      return row ?? null
    },
    async remove(db: PostgresJsDatabase, id: string) {
      const existing = await get(db, id)
      if (!existing) return null
      const [row] = await db
        .delete(customFieldDefinitions)
        .where(eq(customFieldDefinitions.id, id))
        .returning({ id: customFieldDefinitions.id })
      return row ?? null
    },
  }
}
