import { and, desc, eq, ilike, ne, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { externalRefs } from "./schema.js"
import type {
  externalRefListQuerySchema,
  insertExternalRefSchema,
  updateExternalRefSchema,
} from "./validation.js"

type ExternalRefListQuery = z.infer<typeof externalRefListQuerySchema>
type CreateExternalRefInput = z.infer<typeof insertExternalRefSchema>
type UpdateExternalRefInput = z.infer<typeof updateExternalRefSchema>

function toTimestamp(value?: string | null) {
  return value ? new Date(value) : null
}

async function ensurePrimaryRef(
  db: PostgresJsDatabase,
  params: {
    id?: string
    entityType: string
    entityId: string
    sourceSystem: string
  },
) {
  const conditions = [
    eq(externalRefs.entityType, params.entityType),
    eq(externalRefs.entityId, params.entityId),
    eq(externalRefs.sourceSystem, params.sourceSystem),
  ]
  if (params.id) conditions.push(ne(externalRefs.id, params.id))

  await db
    .update(externalRefs)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(...conditions))
}

export const externalRefsService = {
  async listExternalRefs(db: PostgresJsDatabase, query: ExternalRefListQuery) {
    const conditions = []
    if (query.entityType) conditions.push(eq(externalRefs.entityType, query.entityType))
    if (query.entityId) conditions.push(eq(externalRefs.entityId, query.entityId))
    if (query.sourceSystem) conditions.push(eq(externalRefs.sourceSystem, query.sourceSystem))
    if (query.objectType) conditions.push(eq(externalRefs.objectType, query.objectType))
    if (query.namespace) conditions.push(eq(externalRefs.namespace, query.namespace))
    if (query.status) conditions.push(eq(externalRefs.status, query.status))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(ilike(externalRefs.externalId, term))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(externalRefs)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(externalRefs.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(externalRefs).where(where),
    ])

    return {
      data,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getExternalRefById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(externalRefs).where(eq(externalRefs.id, id)).limit(1)
    return row ?? null
  },

  async createExternalRef(db: PostgresJsDatabase, data: CreateExternalRefInput) {
    if (data.isPrimary) {
      await ensurePrimaryRef(db, {
        entityType: data.entityType,
        entityId: data.entityId,
        sourceSystem: data.sourceSystem,
      })
    }

    const [row] = await db
      .insert(externalRefs)
      .values({
        ...data,
        namespace: data.namespace ?? "default",
        lastSyncedAt: toTimestamp(data.lastSyncedAt),
      })
      .returning()

    return row ?? null
  },

  async updateExternalRef(db: PostgresJsDatabase, id: string, data: UpdateExternalRefInput) {
    const existing = await this.getExternalRefById(db, id)
    if (!existing) return null

    const nextEntityType = data.entityType ?? existing.entityType
    const nextEntityId = data.entityId ?? existing.entityId
    const nextSourceSystem = data.sourceSystem ?? existing.sourceSystem

    if (data.isPrimary) {
      await ensurePrimaryRef(db, {
        id,
        entityType: nextEntityType,
        entityId: nextEntityId,
        sourceSystem: nextSourceSystem,
      })
    }

    const [row] = await db
      .update(externalRefs)
      .set({
        ...data,
        namespace: data.namespace ?? existing.namespace,
        lastSyncedAt: data.lastSyncedAt === undefined ? undefined : toTimestamp(data.lastSyncedAt),
        updatedAt: new Date(),
      })
      .where(eq(externalRefs.id, id))
      .returning()

    return row ?? null
  },

  async deleteExternalRef(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(externalRefs)
      .where(eq(externalRefs.id, id))
      .returning({ id: externalRefs.id })
    return row ?? null
  },
}
