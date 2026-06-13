import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { customFieldDefinitions, customFieldValues } from "../schema.js"
import type {
  customFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema,
  insertCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
  upsertCustomFieldValueSchema,
} from "../validation.js"
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
    const [row] = await db
      .update(customFieldDefinitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customFieldDefinitions.id, id))
      .returning()
    return row ?? null
  },

  async deleteCustomFieldDefinition(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(customFieldDefinitions)
      .where(eq(customFieldDefinitions.id, id))
      .returning({ id: customFieldDefinitions.id })
    return row ?? null
  },

  async listCustomFieldValues(db: PostgresJsDatabase, query: CustomFieldValueListQuery) {
    const conditions = []
    if (query.entityType) conditions.push(eq(customFieldValues.entityType, query.entityType))
    if (query.entityId) conditions.push(eq(customFieldValues.entityId, query.entityId))
    if (query.definitionId) conditions.push(eq(customFieldValues.definitionId, query.definitionId))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(customFieldValues)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(customFieldValues.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(customFieldValues).where(where),
      query.limit,
      query.offset,
    )
  },

  async upsertCustomFieldValue(
    db: PostgresJsDatabase,
    definitionId: string,
    data: UpsertCustomFieldValueInput,
  ) {
    const [existing] = await db
      .select()
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.definitionId, definitionId),
          eq(customFieldValues.entityType, data.entityType),
          eq(customFieldValues.entityId, data.entityId),
        ),
      )
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(customFieldValues)
        .set({ ...data, definitionId, updatedAt: new Date() })
        .where(eq(customFieldValues.id, existing.id))
        .returning()
      return row
    }

    const [row] = await db
      .insert(customFieldValues)
      .values({ ...data, definitionId })
      .returning()
    return row
  },

  async deleteCustomFieldValue(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(customFieldValues)
      .where(eq(customFieldValues.id, id))
      .returning({ id: customFieldValues.id })
    return row ?? null
  },
}
