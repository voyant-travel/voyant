import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { activities, activityLinks, activityParticipants } from "../schema.js"
import type {
  activityListQuerySchema,
  insertActivityLinkSchema,
  insertActivityParticipantSchema,
  insertActivitySchema,
  updateActivitySchema,
} from "../validation.js"
import { paginate, toDateOrNull } from "./helpers.js"

type ActivityListQuery = z.infer<typeof activityListQuerySchema>
type CreateActivityInput = z.infer<typeof insertActivitySchema>
type UpdateActivityInput = z.infer<typeof updateActivitySchema>
type CreateActivityLinkInput = z.infer<typeof insertActivityLinkSchema>
type CreateActivityParticipantInput = z.infer<typeof insertActivityParticipantSchema>

export const activitiesService = {
  async listActivities(db: PostgresJsDatabase, query: ActivityListQuery) {
    const conditions = []

    if (query.ownerId) conditions.push(eq(activities.ownerId, query.ownerId))
    if (query.status) conditions.push(eq(activities.status, query.status))
    if (query.type) conditions.push(eq(activities.type, query.type))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(activities.subject, term), ilike(activities.description, term)))
    }

    if (query.entityType && query.entityId) {
      const linkRows = await db
        .select({ activityId: activityLinks.activityId })
        .from(activityLinks)
        .where(
          and(
            eq(activityLinks.entityType, query.entityType),
            eq(activityLinks.entityId, query.entityId),
          ),
        )

      const activityIds = linkRows.map((row) => row.activityId)
      if (activityIds.length === 0) {
        return { data: [], total: 0, limit: query.limit, offset: query.offset }
      }
      conditions.push(inArray(activities.id, activityIds))
    }

    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(activities)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(activities.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(activities).where(where),
      query.limit,
      query.offset,
    )
  },

  async getActivityById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(activities).where(eq(activities.id, id)).limit(1)
    return row ?? null
  },

  async createActivity(db: PostgresJsDatabase, data: CreateActivityInput) {
    const [row] = await db
      .insert(activities)
      .values({
        ...data,
        dueAt: toDateOrNull(data.dueAt),
        completedAt: toDateOrNull(data.completedAt),
      })
      .returning()
    return row
  },

  async updateActivity(db: PostgresJsDatabase, id: string, data: UpdateActivityInput) {
    const patch = {
      ...data,
      dueAt: data.dueAt === undefined ? undefined : toDateOrNull(data.dueAt),
      completedAt: data.completedAt === undefined ? undefined : toDateOrNull(data.completedAt),
      updatedAt: new Date(),
    }

    if (data.status === "done" && !data.completedAt) {
      patch.completedAt = new Date()
    }

    const [row] = await db.update(activities).set(patch).where(eq(activities.id, id)).returning()
    return row ?? null
  },

  async deleteActivity(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(activities)
      .where(eq(activities.id, id))
      .returning({ id: activities.id })
    return row ?? null
  },

  listActivityLinks(db: PostgresJsDatabase, activityId: string) {
    return db
      .select()
      .from(activityLinks)
      .where(eq(activityLinks.activityId, activityId))
      .orderBy(desc(activityLinks.role), activityLinks.createdAt)
  },

  async createActivityLink(
    db: PostgresJsDatabase,
    activityId: string,
    data: CreateActivityLinkInput,
  ) {
    const [row] = await db
      .insert(activityLinks)
      .values({ ...data, activityId })
      .returning()
    return row
  },

  async deleteActivityLink(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(activityLinks)
      .where(eq(activityLinks.id, id))
      .returning({ id: activityLinks.id })
    return row ?? null
  },

  listActivityParticipants(db: PostgresJsDatabase, activityId: string) {
    return db
      .select()
      .from(activityParticipants)
      .where(eq(activityParticipants.activityId, activityId))
      .orderBy(desc(activityParticipants.isPrimary), activityParticipants.createdAt)
  },

  async createActivityParticipant(
    db: PostgresJsDatabase,
    activityId: string,
    data: CreateActivityParticipantInput,
  ) {
    const [row] = await db
      .insert(activityParticipants)
      .values({ ...data, activityId })
      .returning()
    return row
  },

  async deleteActivityParticipant(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(activityParticipants)
      .where(eq(activityParticipants.id, id))
      .returning({ id: activityParticipants.id })
    return row ?? null
  },
}
