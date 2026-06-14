import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { groundDriverShifts, groundDrivers, groundOperators, groundVehicles } from "./schema.js"
import type {
  CreateGroundDriverInput,
  CreateGroundDriverShiftInput,
  CreateGroundOperatorInput,
  CreateGroundVehicleInput,
  GroundDriverListQuery,
  GroundDriverShiftListQuery,
  GroundOperatorListQuery,
  GroundVehicleListQuery,
  UpdateGroundDriverInput,
  UpdateGroundDriverShiftInput,
  UpdateGroundOperatorInput,
  UpdateGroundVehicleInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listOperators(db: PostgresJsDatabase, query: GroundOperatorListQuery) {
  const conditions = []
  if (query.supplierId) conditions.push(eq(groundOperators.supplierId, query.supplierId))
  if (query.facilityId) conditions.push(eq(groundOperators.facilityId, query.facilityId))
  if (query.active !== undefined) conditions.push(eq(groundOperators.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundOperators)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundOperators.name), asc(groundOperators.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundOperators).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOperatorById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(groundOperators).where(eq(groundOperators.id, id)).limit(1)
  return row ?? null
}

export async function createOperator(db: PostgresJsDatabase, data: CreateGroundOperatorInput) {
  const [row] = await db.insert(groundOperators).values(data).returning()
  return row
}

export async function updateOperator(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundOperatorInput,
) {
  const [row] = await db
    .update(groundOperators)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(groundOperators.id, id))
    .returning()
  return row ?? null
}

export async function deleteOperator(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundOperators)
    .where(eq(groundOperators.id, id))
    .returning({ id: groundOperators.id })
  return row ?? null
}

export async function listVehicles(db: PostgresJsDatabase, query: GroundVehicleListQuery) {
  const conditions = []
  if (query.resourceId) conditions.push(eq(groundVehicles.resourceId, query.resourceId))
  if (query.operatorId) conditions.push(eq(groundVehicles.operatorId, query.operatorId))
  if (query.category) conditions.push(eq(groundVehicles.category, query.category))
  if (query.active !== undefined) conditions.push(eq(groundVehicles.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundVehicles)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundVehicles.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundVehicles).where(where),
    query.limit,
    query.offset,
  )
}

export async function getVehicleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(groundVehicles).where(eq(groundVehicles.id, id)).limit(1)
  return row ?? null
}

export async function createVehicle(db: PostgresJsDatabase, data: CreateGroundVehicleInput) {
  const [row] = await db.insert(groundVehicles).values(data).returning()
  return row
}

export async function updateVehicle(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundVehicleInput,
) {
  const [row] = await db
    .update(groundVehicles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(groundVehicles.id, id))
    .returning()
  return row ?? null
}

export async function deleteVehicle(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundVehicles)
    .where(eq(groundVehicles.id, id))
    .returning({ id: groundVehicles.id })
  return row ?? null
}

export async function listDrivers(db: PostgresJsDatabase, query: GroundDriverListQuery) {
  const conditions = []
  if (query.resourceId) conditions.push(eq(groundDrivers.resourceId, query.resourceId))
  if (query.operatorId) conditions.push(eq(groundDrivers.operatorId, query.operatorId))
  if (query.active !== undefined) conditions.push(eq(groundDrivers.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundDrivers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundDrivers.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundDrivers).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDriverById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(groundDrivers).where(eq(groundDrivers.id, id)).limit(1)
  return row ?? null
}

export async function createDriver(db: PostgresJsDatabase, data: CreateGroundDriverInput) {
  const [row] = await db.insert(groundDrivers).values(data).returning()
  return row
}

export async function updateDriver(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundDriverInput,
) {
  const [row] = await db
    .update(groundDrivers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(groundDrivers.id, id))
    .returning()
  return row ?? null
}

export async function deleteDriver(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundDrivers)
    .where(eq(groundDrivers.id, id))
    .returning({ id: groundDrivers.id })
  return row ?? null
}

export async function listDriverShifts(db: PostgresJsDatabase, query: GroundDriverShiftListQuery) {
  const conditions = []
  if (query.driverId) conditions.push(eq(groundDriverShifts.driverId, query.driverId))
  if (query.operatorId) conditions.push(eq(groundDriverShifts.operatorId, query.operatorId))
  if (query.facilityId) conditions.push(eq(groundDriverShifts.facilityId, query.facilityId))
  if (query.status) conditions.push(eq(groundDriverShifts.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundDriverShifts)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundDriverShifts.startsAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundDriverShifts).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDriverShiftById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundDriverShifts)
    .where(eq(groundDriverShifts.id, id))
    .limit(1)
  return row ?? null
}

export async function createDriverShift(
  db: PostgresJsDatabase,
  data: CreateGroundDriverShiftInput,
) {
  const [row] = await db
    .insert(groundDriverShifts)
    .values({
      ...data,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
    })
    .returning()
  return row
}

export async function updateDriverShift(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundDriverShiftInput,
) {
  const [row] = await db
    .update(groundDriverShifts)
    .set({
      ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(groundDriverShifts.id, id))
    .returning()
  return row ?? null
}

export async function deleteDriverShift(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundDriverShifts)
    .where(eq(groundDriverShifts.id, id))
    .returning({ id: groundDriverShifts.id })
  return row ?? null
}
