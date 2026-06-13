import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { groundDispatches, groundExecutionEvents, groundTransferPreferences } from "./schema.js"
import type {
  CreateGroundDispatchInput,
  CreateGroundExecutionEventInput,
  CreateGroundTransferPreferenceInput,
  GroundDispatchListQuery,
  GroundExecutionEventListQuery,
  GroundTransferPreferenceListQuery,
  UpdateGroundDispatchInput,
  UpdateGroundExecutionEventInput,
  UpdateGroundTransferPreferenceInput,
} from "./service-shared.js"
import { paginate, toDateOrNull } from "./service-shared.js"

export async function listTransferPreferences(
  db: PostgresJsDatabase,
  query: GroundTransferPreferenceListQuery,
) {
  const conditions = []
  if (query.bookingId) conditions.push(eq(groundTransferPreferences.bookingId, query.bookingId))
  if (query.bookingItemId) {
    conditions.push(eq(groundTransferPreferences.bookingItemId, query.bookingItemId))
  }
  if (query.serviceLevel) {
    conditions.push(eq(groundTransferPreferences.serviceLevel, query.serviceLevel))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundTransferPreferences)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundTransferPreferences.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundTransferPreferences).where(where),
    query.limit,
    query.offset,
  )
}

export async function getTransferPreferenceById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundTransferPreferences)
    .where(eq(groundTransferPreferences.id, id))
    .limit(1)
  return row ?? null
}

export async function createTransferPreference(
  db: PostgresJsDatabase,
  data: CreateGroundTransferPreferenceInput,
) {
  const [row] = await db.insert(groundTransferPreferences).values(data).returning()
  return row
}

export async function updateTransferPreference(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundTransferPreferenceInput,
) {
  const [row] = await db
    .update(groundTransferPreferences)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(groundTransferPreferences.id, id))
    .returning()
  return row ?? null
}

export async function deleteTransferPreference(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundTransferPreferences)
    .where(eq(groundTransferPreferences.id, id))
    .returning({ id: groundTransferPreferences.id })
  return row ?? null
}

export async function listDispatches(db: PostgresJsDatabase, query: GroundDispatchListQuery) {
  const conditions = []
  if (query.transferPreferenceId) {
    conditions.push(eq(groundDispatches.transferPreferenceId, query.transferPreferenceId))
  }
  if (query.bookingId) conditions.push(eq(groundDispatches.bookingId, query.bookingId))
  if (query.bookingItemId) conditions.push(eq(groundDispatches.bookingItemId, query.bookingItemId))
  if (query.operatorId) conditions.push(eq(groundDispatches.operatorId, query.operatorId))
  if (query.vehicleId) conditions.push(eq(groundDispatches.vehicleId, query.vehicleId))
  if (query.driverId) conditions.push(eq(groundDispatches.driverId, query.driverId))
  if (query.status) conditions.push(eq(groundDispatches.status, query.status))
  if (query.serviceDate) conditions.push(eq(groundDispatches.serviceDate, query.serviceDate))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundDispatches)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundDispatches.serviceDate), asc(groundDispatches.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundDispatches).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDispatchById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(groundDispatches).where(eq(groundDispatches.id, id)).limit(1)
  return row ?? null
}

export async function createDispatch(db: PostgresJsDatabase, data: CreateGroundDispatchInput) {
  const { scheduledPickupAt, scheduledDropoffAt, actualPickupAt, actualDropoffAt, ...rest } = data
  const [row] = await db
    .insert(groundDispatches)
    .values({
      ...rest,
      scheduledPickupAt: toDateOrNull(scheduledPickupAt),
      scheduledDropoffAt: toDateOrNull(scheduledDropoffAt),
      actualPickupAt: toDateOrNull(actualPickupAt),
      actualDropoffAt: toDateOrNull(actualDropoffAt),
    })
    .returning()
  return row
}

export async function updateDispatch(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundDispatchInput,
) {
  const { scheduledPickupAt, scheduledDropoffAt, actualPickupAt, actualDropoffAt, ...rest } = data
  const [row] = await db
    .update(groundDispatches)
    .set({
      ...rest,
      scheduledPickupAt: toDateOrNull(scheduledPickupAt),
      scheduledDropoffAt: toDateOrNull(scheduledDropoffAt),
      actualPickupAt: toDateOrNull(actualPickupAt),
      actualDropoffAt: toDateOrNull(actualDropoffAt),
      updatedAt: new Date(),
    })
    .where(eq(groundDispatches.id, id))
    .returning()
  return row ?? null
}

export async function deleteDispatch(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundDispatches)
    .where(eq(groundDispatches.id, id))
    .returning({ id: groundDispatches.id })
  return row ?? null
}

export async function listExecutionEvents(
  db: PostgresJsDatabase,
  query: GroundExecutionEventListQuery,
) {
  const conditions = []
  if (query.dispatchId) conditions.push(eq(groundExecutionEvents.dispatchId, query.dispatchId))
  if (query.eventType) conditions.push(eq(groundExecutionEvents.eventType, query.eventType))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundExecutionEvents)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundExecutionEvents.occurredAt), asc(groundExecutionEvents.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundExecutionEvents).where(where),
    query.limit,
    query.offset,
  )
}

export async function getExecutionEventById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundExecutionEvents)
    .where(eq(groundExecutionEvents.id, id))
    .limit(1)
  return row ?? null
}

export async function createExecutionEvent(
  db: PostgresJsDatabase,
  data: CreateGroundExecutionEventInput,
) {
  const { occurredAt, ...rest } = data
  const [row] = await db
    .insert(groundExecutionEvents)
    .values({
      ...rest,
      occurredAt: toDateOrNull(occurredAt) ?? new Date(),
    })
    .returning()
  return row
}

export async function updateExecutionEvent(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundExecutionEventInput,
) {
  const { occurredAt, ...rest } = data
  const [row] = await db
    .update(groundExecutionEvents)
    .set({
      ...rest,
      occurredAt: occurredAt === undefined ? undefined : (toDateOrNull(occurredAt) ?? new Date()),
    })
    .where(eq(groundExecutionEvents.id, id))
    .returning()
  return row ?? null
}

export async function deleteExecutionEvent(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundExecutionEvents)
    .where(eq(groundExecutionEvents.id, id))
    .returning({ id: groundExecutionEvents.id })
  return row ?? null
}
