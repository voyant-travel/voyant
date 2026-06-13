import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { facilityFeatures, facilityOperationSchedules } from "./schema.js"
import type {
  CreateFacilityFeatureInput,
  CreateFacilityOperationScheduleInput,
  FacilityFeatureListQuery,
  FacilityOperationScheduleListQuery,
  UpdateFacilityFeatureInput,
  UpdateFacilityOperationScheduleInput,
} from "./service-shared.js"
import { ensureFacilityExists, paginate } from "./service-shared.js"

export async function listFacilityFeatures(
  db: PostgresJsDatabase,
  query: FacilityFeatureListQuery,
) {
  const conditions = []
  if (query.facilityId) conditions.push(eq(facilityFeatures.facilityId, query.facilityId))
  if (query.category) conditions.push(eq(facilityFeatures.category, query.category))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(facilityFeatures)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(facilityFeatures.sortOrder, facilityFeatures.name),
    db.select({ count: sql<number>`count(*)::int` }).from(facilityFeatures).where(where),
    query.limit,
    query.offset,
  )
}

export async function createFacilityFeature(
  db: PostgresJsDatabase,
  facilityId: string,
  data: CreateFacilityFeatureInput,
) {
  const facility = await ensureFacilityExists(db, facilityId)
  if (!facility) return null

  const [row] = await db
    .insert(facilityFeatures)
    .values({ ...data, facilityId })
    .returning()
  return row ?? null
}

export async function updateFacilityFeature(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateFacilityFeatureInput,
) {
  const [row] = await db
    .update(facilityFeatures)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(facilityFeatures.id, id))
    .returning()
  return row ?? null
}

export async function deleteFacilityFeature(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(facilityFeatures)
    .where(eq(facilityFeatures.id, id))
    .returning({ id: facilityFeatures.id })
  return row ?? null
}

export async function listFacilityOperationSchedules(
  db: PostgresJsDatabase,
  query: FacilityOperationScheduleListQuery,
) {
  const conditions = []
  if (query.facilityId) {
    conditions.push(eq(facilityOperationSchedules.facilityId, query.facilityId))
  }
  if (query.dayOfWeek) {
    conditions.push(eq(facilityOperationSchedules.dayOfWeek, query.dayOfWeek))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(facilityOperationSchedules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(facilityOperationSchedules.dayOfWeek, desc(facilityOperationSchedules.validFrom)),
    db.select({ count: sql<number>`count(*)::int` }).from(facilityOperationSchedules).where(where),
    query.limit,
    query.offset,
  )
}

export async function createFacilityOperationSchedule(
  db: PostgresJsDatabase,
  facilityId: string,
  data: CreateFacilityOperationScheduleInput,
) {
  const facility = await ensureFacilityExists(db, facilityId)
  if (!facility) return null

  const [row] = await db
    .insert(facilityOperationSchedules)
    .values({ ...data, facilityId })
    .returning()
  return row ?? null
}

export async function updateFacilityOperationSchedule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateFacilityOperationScheduleInput,
) {
  const [row] = await db
    .update(facilityOperationSchedules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(facilityOperationSchedules.id, id))
    .returning()
  return row ?? null
}

export async function deleteFacilityOperationSchedule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(facilityOperationSchedules)
    .where(eq(facilityOperationSchedules.id, id))
    .returning({ id: facilityOperationSchedules.id })
  return row ?? null
}
