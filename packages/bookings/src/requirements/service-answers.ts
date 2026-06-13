import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { bookingAnswers } from "./schema.js"
import type {
  BookingAnswerListQuery,
  CreateBookingAnswerInput,
  UpdateBookingAnswerInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listBookingAnswers(db: PostgresJsDatabase, query: BookingAnswerListQuery) {
  const conditions = []
  if (query.bookingId) conditions.push(eq(bookingAnswers.bookingId, query.bookingId))
  if (query.productBookingQuestionId)
    conditions.push(eq(bookingAnswers.productBookingQuestionId, query.productBookingQuestionId))
  if (query.bookingTravelerId)
    conditions.push(eq(bookingAnswers.bookingTravelerId, query.bookingTravelerId))
  if (query.bookingExtraId) conditions.push(eq(bookingAnswers.bookingExtraId, query.bookingExtraId))
  if (query.target) conditions.push(eq(bookingAnswers.target, query.target))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(bookingAnswers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(bookingAnswers.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(bookingAnswers).where(where),
    query.limit,
    query.offset,
  )
}

export async function getBookingAnswerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(bookingAnswers).where(eq(bookingAnswers.id, id)).limit(1)
  return row ?? null
}

export async function createBookingAnswer(db: PostgresJsDatabase, data: CreateBookingAnswerInput) {
  const [row] = await db.insert(bookingAnswers).values(data).returning()
  return row ?? null
}

export async function updateBookingAnswer(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateBookingAnswerInput,
) {
  const [row] = await db
    .update(bookingAnswers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bookingAnswers.id, id))
    .returning()
  return row ?? null
}

export async function deleteBookingAnswer(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(bookingAnswers)
    .where(eq(bookingAnswers.id, id))
    .returning({ id: bookingAnswers.id })
  return row ?? null
}
