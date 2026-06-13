import { and, asc, eq, sql } from "drizzle-orm"

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { offerItemParticipants, offerItems } from "./schema.js"

import type {
  CreateOfferItemInput,
  CreateOfferItemTravelerInput,
  OfferItemListQuery,
  OfferItemTravelerListQuery,
  UpdateOfferItemInput,
  UpdateOfferItemTravelerInput,
} from "./service-shared.js"

import { normalizeTimestamp, paginate, toOfferItemTravelerResponse } from "./service-shared.js"

export async function listOfferItems(db: PostgresJsDatabase, query: OfferItemListQuery) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerItems.offerId, query.offerId))
  if (query.productId) conditions.push(eq(offerItems.productId, query.productId))
  if (query.optionId) conditions.push(eq(offerItems.optionId, query.optionId))
  if (query.unitId) conditions.push(eq(offerItems.unitId, query.unitId))
  if (query.slotId) conditions.push(eq(offerItems.slotId, query.slotId))
  if (query.status) conditions.push(eq(offerItems.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerItems)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerItems.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerItems).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOfferItemById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(offerItems).where(eq(offerItems.id, id)).limit(1)
  return row ?? null
}

export async function createOfferItem(db: PostgresJsDatabase, data: CreateOfferItemInput) {
  const { startsAt, endsAt, ...rest } = data
  const [row] = await db
    .insert(offerItems)
    .values({
      ...rest,
      startsAt: normalizeTimestamp(startsAt),
      endsAt: normalizeTimestamp(endsAt),
    })
    .returning()
  return row ?? null
}

export async function updateOfferItem(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferItemInput,
) {
  const { startsAt, endsAt, ...rest } = data
  const [row] = await db
    .update(offerItems)
    .set({
      ...rest,
      startsAt: normalizeTimestamp(startsAt),
      endsAt: normalizeTimestamp(endsAt),
      updatedAt: new Date(),
    })
    .where(eq(offerItems.id, id))
    .returning()
  return row ?? null
}

export async function deleteOfferItem(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerItems)
    .where(eq(offerItems.id, id))
    .returning({ id: offerItems.id })
  return row ?? null
}

export async function listOfferItemTravelers(
  db: PostgresJsDatabase,
  query: OfferItemTravelerListQuery,
) {
  const conditions = []
  if (query.offerItemId) conditions.push(eq(offerItemParticipants.offerItemId, query.offerItemId))
  if (query.travelerId) conditions.push(eq(offerItemParticipants.travelerId, query.travelerId))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerItemParticipants)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerItemParticipants.createdAt))
      .then((items) => items.map(toOfferItemTravelerResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerItemParticipants).where(where),
    query.limit,
    query.offset,
  )
}

export const listOfferItemParticipants = listOfferItemTravelers

export async function getOfferItemTravelerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerItemParticipants)
    .where(eq(offerItemParticipants.id, id))
    .limit(1)
  return row ? toOfferItemTravelerResponse(row) : null
}

export const getOfferItemParticipantById = getOfferItemTravelerById

export async function createOfferItemTraveler(
  db: PostgresJsDatabase,
  data: CreateOfferItemTravelerInput,
) {
  const [row] = await db.insert(offerItemParticipants).values(data).returning()
  return row ? toOfferItemTravelerResponse(row) : null
}

export const createOfferItemParticipant = createOfferItemTraveler

export async function updateOfferItemTraveler(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferItemTravelerInput,
) {
  const [row] = await db
    .update(offerItemParticipants)
    .set(data)
    .where(eq(offerItemParticipants.id, id))
    .returning()
  return row ? toOfferItemTravelerResponse(row) : null
}

export const updateOfferItemParticipant = updateOfferItemTraveler

export async function deleteOfferItemTraveler(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerItemParticipants)
    .where(eq(offerItemParticipants.id, id))
    .returning({ id: offerItemParticipants.id })
  return row ?? null
}

export const deleteOfferItemParticipant = deleteOfferItemTraveler
