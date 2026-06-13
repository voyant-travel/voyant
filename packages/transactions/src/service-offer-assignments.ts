import { and, asc, eq, sql } from "drizzle-orm"

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { offerContactAssignments, offerStaffAssignments } from "./schema.js"

import type {
  CreateOfferContactAssignmentInput,
  CreateOfferStaffAssignmentInput,
  OfferContactAssignmentListQuery,
  OfferStaffAssignmentListQuery,
  UpdateOfferContactAssignmentInput,
  UpdateOfferStaffAssignmentInput,
} from "./service-shared.js"

import {
  paginate,
  toOfferContactAssignmentResponse,
  toOfferStaffAssignmentResponse,
} from "./service-shared.js"

export async function listOfferContactAssignments(
  db: PostgresJsDatabase,
  query: OfferContactAssignmentListQuery,
) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerContactAssignments.offerId, query.offerId))
  if (query.offerItemId) conditions.push(eq(offerContactAssignments.offerItemId, query.offerItemId))
  if (query.personId) conditions.push(eq(offerContactAssignments.personId, query.personId))
  if (query.role) conditions.push(eq(offerContactAssignments.role, query.role))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerContactAssignments)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerContactAssignments.createdAt))
      .then((items) => items.map(toOfferContactAssignmentResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerContactAssignments).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOfferContactAssignmentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerContactAssignments)
    .where(eq(offerContactAssignments.id, id))
    .limit(1)
  return row ? toOfferContactAssignmentResponse(row) : null
}

export async function createOfferContactAssignment(
  db: PostgresJsDatabase,
  data: CreateOfferContactAssignmentInput,
) {
  const [row] = await db.insert(offerContactAssignments).values(data).returning()
  return row ? toOfferContactAssignmentResponse(row) : null
}

export async function updateOfferContactAssignment(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferContactAssignmentInput,
) {
  const [row] = await db
    .update(offerContactAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(offerContactAssignments.id, id))
    .returning()
  return row ? toOfferContactAssignmentResponse(row) : null
}

export async function deleteOfferContactAssignment(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerContactAssignments)
    .where(eq(offerContactAssignments.id, id))
    .returning({ id: offerContactAssignments.id })
  return row ?? null
}

export async function listOfferStaffAssignments(
  db: PostgresJsDatabase,
  query: OfferStaffAssignmentListQuery,
) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerStaffAssignments.offerId, query.offerId))
  if (query.offerItemId) conditions.push(eq(offerStaffAssignments.offerItemId, query.offerItemId))
  if (query.personId) conditions.push(eq(offerStaffAssignments.personId, query.personId))
  if (query.role) conditions.push(eq(offerStaffAssignments.role, query.role))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerStaffAssignments)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerStaffAssignments.createdAt))
      .then((items) => items.map(toOfferStaffAssignmentResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerStaffAssignments).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOfferStaffAssignmentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerStaffAssignments)
    .where(eq(offerStaffAssignments.id, id))
    .limit(1)
  return row ? toOfferStaffAssignmentResponse(row) : null
}

export async function createOfferStaffAssignment(
  db: PostgresJsDatabase,
  data: CreateOfferStaffAssignmentInput,
) {
  const [row] = await db.insert(offerStaffAssignments).values(data).returning()
  return row ? toOfferStaffAssignmentResponse(row) : null
}

export async function updateOfferStaffAssignment(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferStaffAssignmentInput,
) {
  const [row] = await db
    .update(offerStaffAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(offerStaffAssignments.id, id))
    .returning()
  return row ? toOfferStaffAssignmentResponse(row) : null
}

export async function deleteOfferStaffAssignment(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerStaffAssignments)
    .where(eq(offerStaffAssignments.id, id))
    .returning({ id: offerStaffAssignments.id })
  return row ?? null
}
