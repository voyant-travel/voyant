import { and, asc, eq, sql } from "drizzle-orm"

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { offerParticipants } from "./schema.js"

import type {
  CreateOfferTravelerInput,
  OfferTravelerListQuery,
  UpdateOfferTravelerInput,
} from "./service-shared.js"

import { paginate, toOfferTravelerResponse } from "./service-shared.js"

export async function listOfferTravelers(db: PostgresJsDatabase, query: OfferTravelerListQuery) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerParticipants.offerId, query.offerId))
  if (query.personId) conditions.push(eq(offerParticipants.personId, query.personId))
  const where = conditions.length ? and(...conditions) : undefined
  const rows = db
    .select()
    .from(offerParticipants)
    .where(where)
    .limit(query.limit)
    .offset(query.offset)
    .orderBy(asc(offerParticipants.createdAt))
    .then((items) => items.map(toOfferTravelerResponse))
  return paginate(
    rows,
    db.select({ count: sql<number>`count(*)::int` }).from(offerParticipants).where(where),
    query.limit,
    query.offset,
  )
}

export const listOfferParticipants = listOfferTravelers

export async function getOfferTravelerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerParticipants)
    .where(eq(offerParticipants.id, id))
    .limit(1)
  return row ? toOfferTravelerResponse(row) : null
}

export const getOfferParticipantById = getOfferTravelerById

export async function createOfferTraveler(db: PostgresJsDatabase, data: CreateOfferTravelerInput) {
  const { dateOfBirth, nationality, ...rest } = data
  void dateOfBirth
  void nationality
  const [row] = await db.insert(offerParticipants).values(rest).returning()
  return row ? toOfferTravelerResponse(row) : null
}

export const createOfferParticipant = createOfferTraveler

export async function updateOfferTraveler(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferTravelerInput,
) {
  const { dateOfBirth, nationality, ...rest } = data
  void dateOfBirth
  void nationality
  const [row] = await db
    .update(offerParticipants)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(offerParticipants.id, id))
    .returning()
  return row ? toOfferTravelerResponse(row) : null
}

export const updateOfferParticipant = updateOfferTraveler

export async function deleteOfferTraveler(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerParticipants)
    .where(eq(offerParticipants.id, id))
    .returning({ id: offerParticipants.id })
  return row ?? null
}

export const deleteOfferParticipant = deleteOfferTraveler
