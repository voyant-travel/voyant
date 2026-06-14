import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  groundDispatchAssignments,
  groundDispatchCheckpoints,
  groundDispatchLegs,
  groundDispatchPassengers,
  groundServiceIncidents,
} from "./schema.js"
import type {
  CreateGroundDispatchAssignmentInput,
  CreateGroundDispatchCheckpointInput,
  CreateGroundDispatchLegInput,
  CreateGroundDispatchPassengerInput,
  CreateGroundServiceIncidentInput,
  GroundDispatchAssignmentListQuery,
  GroundDispatchCheckpointListQuery,
  GroundDispatchLegListQuery,
  GroundDispatchPassengerListQuery,
  GroundServiceIncidentListQuery,
  UpdateGroundDispatchAssignmentInput,
  UpdateGroundDispatchCheckpointInput,
  UpdateGroundDispatchLegInput,
  UpdateGroundDispatchPassengerInput,
  UpdateGroundServiceIncidentInput,
} from "./service-shared.js"
import { paginate, toDateOrNull } from "./service-shared.js"

export async function listDispatchAssignments(
  db: PostgresJsDatabase,
  query: GroundDispatchAssignmentListQuery,
) {
  const conditions = []
  if (query.dispatchId) conditions.push(eq(groundDispatchAssignments.dispatchId, query.dispatchId))
  if (query.operatorId) conditions.push(eq(groundDispatchAssignments.operatorId, query.operatorId))
  if (query.vehicleId) conditions.push(eq(groundDispatchAssignments.vehicleId, query.vehicleId))
  if (query.driverId) conditions.push(eq(groundDispatchAssignments.driverId, query.driverId))
  if (query.assignmentSource) {
    conditions.push(eq(groundDispatchAssignments.assignmentSource, query.assignmentSource))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundDispatchAssignments)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundDispatchAssignments.assignedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundDispatchAssignments).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDispatchAssignmentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundDispatchAssignments)
    .where(eq(groundDispatchAssignments.id, id))
    .limit(1)
  return row ?? null
}

export async function createDispatchAssignment(
  db: PostgresJsDatabase,
  data: CreateGroundDispatchAssignmentInput,
) {
  const [row] = await db
    .insert(groundDispatchAssignments)
    .values({
      ...data,
      assignedAt: toDateOrNull(data.assignedAt) ?? new Date(),
      acceptedAt: toDateOrNull(data.acceptedAt),
    })
    .returning()
  return row
}

export async function updateDispatchAssignment(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundDispatchAssignmentInput,
) {
  const [row] = await db
    .update(groundDispatchAssignments)
    .set({
      ...data,
      assignedAt: data.assignedAt ? new Date(data.assignedAt) : undefined,
      acceptedAt: data.acceptedAt ? new Date(data.acceptedAt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(groundDispatchAssignments.id, id))
    .returning()
  return row ?? null
}

export async function deleteDispatchAssignment(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundDispatchAssignments)
    .where(eq(groundDispatchAssignments.id, id))
    .returning({ id: groundDispatchAssignments.id })
  return row ?? null
}

export async function listDispatchLegs(db: PostgresJsDatabase, query: GroundDispatchLegListQuery) {
  const conditions = []
  if (query.dispatchId) conditions.push(eq(groundDispatchLegs.dispatchId, query.dispatchId))
  if (query.legType) conditions.push(eq(groundDispatchLegs.legType, query.legType))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundDispatchLegs)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundDispatchLegs.sequence)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundDispatchLegs).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDispatchLegById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundDispatchLegs)
    .where(eq(groundDispatchLegs.id, id))
    .limit(1)
  return row ?? null
}

export async function createDispatchLeg(
  db: PostgresJsDatabase,
  data: CreateGroundDispatchLegInput,
) {
  const [row] = await db
    .insert(groundDispatchLegs)
    .values({
      ...data,
      scheduledAt: toDateOrNull(data.scheduledAt),
      actualAt: toDateOrNull(data.actualAt),
    })
    .returning()
  return row
}

export async function updateDispatchLeg(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundDispatchLegInput,
) {
  const [row] = await db
    .update(groundDispatchLegs)
    .set({
      ...data,
      scheduledAt: toDateOrNull(data.scheduledAt),
      actualAt: toDateOrNull(data.actualAt),
      updatedAt: new Date(),
    })
    .where(eq(groundDispatchLegs.id, id))
    .returning()
  return row ?? null
}

export async function deleteDispatchLeg(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundDispatchLegs)
    .where(eq(groundDispatchLegs.id, id))
    .returning({ id: groundDispatchLegs.id })
  return row ?? null
}

export async function listDispatchPassengers(
  db: PostgresJsDatabase,
  query: GroundDispatchPassengerListQuery,
) {
  const conditions = []
  if (query.dispatchId) conditions.push(eq(groundDispatchPassengers.dispatchId, query.dispatchId))
  if (query.participantId) {
    conditions.push(eq(groundDispatchPassengers.participantId, query.participantId))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundDispatchPassengers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundDispatchPassengers.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundDispatchPassengers).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDispatchPassengerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundDispatchPassengers)
    .where(eq(groundDispatchPassengers.id, id))
    .limit(1)
  return row ?? null
}

export async function createDispatchPassenger(
  db: PostgresJsDatabase,
  data: CreateGroundDispatchPassengerInput,
) {
  const [row] = await db.insert(groundDispatchPassengers).values(data).returning()
  return row
}

export async function updateDispatchPassenger(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundDispatchPassengerInput,
) {
  const [row] = await db
    .update(groundDispatchPassengers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(groundDispatchPassengers.id, id))
    .returning()
  return row ?? null
}

export async function deleteDispatchPassenger(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundDispatchPassengers)
    .where(eq(groundDispatchPassengers.id, id))
    .returning({ id: groundDispatchPassengers.id })
  return row ?? null
}

export async function listServiceIncidents(
  db: PostgresJsDatabase,
  query: GroundServiceIncidentListQuery,
) {
  const conditions = []
  if (query.dispatchId) conditions.push(eq(groundServiceIncidents.dispatchId, query.dispatchId))
  if (query.severity) conditions.push(eq(groundServiceIncidents.severity, query.severity))
  if (query.resolutionStatus) {
    conditions.push(eq(groundServiceIncidents.resolutionStatus, query.resolutionStatus))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundServiceIncidents)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(groundServiceIncidents.openedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundServiceIncidents).where(where),
    query.limit,
    query.offset,
  )
}

export async function getServiceIncidentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundServiceIncidents)
    .where(eq(groundServiceIncidents.id, id))
    .limit(1)
  return row ?? null
}

export async function createServiceIncident(
  db: PostgresJsDatabase,
  data: CreateGroundServiceIncidentInput,
) {
  const [row] = await db
    .insert(groundServiceIncidents)
    .values({
      ...data,
      openedAt: toDateOrNull(data.openedAt) ?? new Date(),
      resolvedAt: toDateOrNull(data.resolvedAt),
    })
    .returning()
  return row
}

export async function updateServiceIncident(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundServiceIncidentInput,
) {
  const [row] = await db
    .update(groundServiceIncidents)
    .set({
      ...data,
      openedAt: data.openedAt ? new Date(data.openedAt) : undefined,
      resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(groundServiceIncidents.id, id))
    .returning()
  return row ?? null
}

export async function deleteServiceIncident(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundServiceIncidents)
    .where(eq(groundServiceIncidents.id, id))
    .returning({ id: groundServiceIncidents.id })
  return row ?? null
}

export async function listDispatchCheckpoints(
  db: PostgresJsDatabase,
  query: GroundDispatchCheckpointListQuery,
) {
  const conditions = []
  if (query.dispatchId) conditions.push(eq(groundDispatchCheckpoints.dispatchId, query.dispatchId))
  if (query.status) conditions.push(eq(groundDispatchCheckpoints.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(groundDispatchCheckpoints)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(groundDispatchCheckpoints.sequence)),
    db.select({ count: sql<number>`count(*)::int` }).from(groundDispatchCheckpoints).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDispatchCheckpointById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(groundDispatchCheckpoints)
    .where(eq(groundDispatchCheckpoints.id, id))
    .limit(1)
  return row ?? null
}

export async function createDispatchCheckpoint(
  db: PostgresJsDatabase,
  data: CreateGroundDispatchCheckpointInput,
) {
  const [row] = await db
    .insert(groundDispatchCheckpoints)
    .values({
      ...data,
      plannedAt: toDateOrNull(data.plannedAt),
      actualAt: toDateOrNull(data.actualAt),
    })
    .returning()
  return row
}

export async function updateDispatchCheckpoint(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateGroundDispatchCheckpointInput,
) {
  const [row] = await db
    .update(groundDispatchCheckpoints)
    .set({
      ...data,
      plannedAt: toDateOrNull(data.plannedAt),
      actualAt: toDateOrNull(data.actualAt),
      updatedAt: new Date(),
    })
    .where(eq(groundDispatchCheckpoints.id, id))
    .returning()
  return row ?? null
}

export async function deleteDispatchCheckpoint(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(groundDispatchCheckpoints)
    .where(eq(groundDispatchCheckpoints.id, id))
    .returning({ id: groundDispatchCheckpoints.id })
  return row ?? null
}
