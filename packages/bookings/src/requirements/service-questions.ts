import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  bookingQuestionExtraTriggers,
  bookingQuestionOptions,
  bookingQuestionOptionTriggers,
  bookingQuestionUnitTriggers,
  optionBookingQuestions,
  productBookingQuestions,
  productContactRequirements,
} from "./schema.js"
import type {
  BookingQuestionExtraTriggerListQuery,
  BookingQuestionOptionListQuery,
  BookingQuestionOptionTriggerListQuery,
  BookingQuestionUnitTriggerListQuery,
  CreateBookingQuestionExtraTriggerInput,
  CreateBookingQuestionOptionInput,
  CreateBookingQuestionOptionTriggerInput,
  CreateBookingQuestionUnitTriggerInput,
  CreateOptionBookingQuestionInput,
  CreateProductBookingQuestionInput,
  CreateProductContactRequirementInput,
  OptionBookingQuestionListQuery,
  ProductBookingQuestionListQuery,
  ProductContactRequirementListQuery,
  UpdateBookingQuestionExtraTriggerInput,
  UpdateBookingQuestionOptionInput,
  UpdateBookingQuestionOptionTriggerInput,
  UpdateBookingQuestionUnitTriggerInput,
  UpdateOptionBookingQuestionInput,
  UpdateProductBookingQuestionInput,
  UpdateProductContactRequirementInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listProductContactRequirements(
  db: PostgresJsDatabase,
  query: ProductContactRequirementListQuery,
) {
  const conditions = []
  if (query.productId) conditions.push(eq(productContactRequirements.productId, query.productId))
  if (query.optionId) conditions.push(eq(productContactRequirements.optionId, query.optionId))
  if (query.active !== undefined)
    conditions.push(eq(productContactRequirements.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(productContactRequirements)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(productContactRequirements.sortOrder)),
    db.select({ count: sql<number>`count(*)::int` }).from(productContactRequirements).where(where),
    query.limit,
    query.offset,
  )
}

export async function getProductContactRequirementById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(productContactRequirements)
    .where(eq(productContactRequirements.id, id))
    .limit(1)
  return row ?? null
}

export async function createProductContactRequirement(
  db: PostgresJsDatabase,
  data: CreateProductContactRequirementInput,
) {
  const [row] = await db.insert(productContactRequirements).values(data).returning()
  return row ?? null
}

export async function updateProductContactRequirement(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateProductContactRequirementInput,
) {
  const [row] = await db
    .update(productContactRequirements)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(productContactRequirements.id, id))
    .returning()
  return row ?? null
}

export async function deleteProductContactRequirement(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(productContactRequirements)
    .where(eq(productContactRequirements.id, id))
    .returning({ id: productContactRequirements.id })
  return row ?? null
}

export async function listProductBookingQuestions(
  db: PostgresJsDatabase,
  query: ProductBookingQuestionListQuery,
) {
  const conditions = []
  if (query.productId) conditions.push(eq(productBookingQuestions.productId, query.productId))
  if (query.target) conditions.push(eq(productBookingQuestions.target, query.target))
  if (query.fieldType) conditions.push(eq(productBookingQuestions.fieldType, query.fieldType))
  if (query.active !== undefined) conditions.push(eq(productBookingQuestions.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(productBookingQuestions)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(productBookingQuestions.sortOrder)),
    db.select({ count: sql<number>`count(*)::int` }).from(productBookingQuestions).where(where),
    query.limit,
    query.offset,
  )
}

export async function getProductBookingQuestionById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(productBookingQuestions)
    .where(eq(productBookingQuestions.id, id))
    .limit(1)
  return row ?? null
}

export async function createProductBookingQuestion(
  db: PostgresJsDatabase,
  data: CreateProductBookingQuestionInput,
) {
  const [row] = await db.insert(productBookingQuestions).values(data).returning()
  return row ?? null
}

export async function updateProductBookingQuestion(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateProductBookingQuestionInput,
) {
  const [row] = await db
    .update(productBookingQuestions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(productBookingQuestions.id, id))
    .returning()
  return row ?? null
}

export async function deleteProductBookingQuestion(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(productBookingQuestions)
    .where(eq(productBookingQuestions.id, id))
    .returning({ id: productBookingQuestions.id })
  return row ?? null
}

export async function listOptionBookingQuestions(
  db: PostgresJsDatabase,
  query: OptionBookingQuestionListQuery,
) {
  const conditions = []
  if (query.optionId) conditions.push(eq(optionBookingQuestions.optionId, query.optionId))
  if (query.productBookingQuestionId)
    conditions.push(
      eq(optionBookingQuestions.productBookingQuestionId, query.productBookingQuestionId),
    )
  if (query.active !== undefined) conditions.push(eq(optionBookingQuestions.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(optionBookingQuestions)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(optionBookingQuestions.sortOrder)),
    db.select({ count: sql<number>`count(*)::int` }).from(optionBookingQuestions).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOptionBookingQuestionById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(optionBookingQuestions)
    .where(eq(optionBookingQuestions.id, id))
    .limit(1)
  return row ?? null
}

export async function createOptionBookingQuestion(
  db: PostgresJsDatabase,
  data: CreateOptionBookingQuestionInput,
) {
  const [row] = await db.insert(optionBookingQuestions).values(data).returning()
  return row ?? null
}

export async function updateOptionBookingQuestion(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOptionBookingQuestionInput,
) {
  const [row] = await db
    .update(optionBookingQuestions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(optionBookingQuestions.id, id))
    .returning()
  return row ?? null
}

export async function deleteOptionBookingQuestion(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(optionBookingQuestions)
    .where(eq(optionBookingQuestions.id, id))
    .returning({ id: optionBookingQuestions.id })
  return row ?? null
}

export async function listBookingQuestionOptions(
  db: PostgresJsDatabase,
  query: BookingQuestionOptionListQuery,
) {
  const conditions = []
  if (query.productBookingQuestionId)
    conditions.push(
      eq(bookingQuestionOptions.productBookingQuestionId, query.productBookingQuestionId),
    )
  if (query.active !== undefined) conditions.push(eq(bookingQuestionOptions.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(bookingQuestionOptions)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(bookingQuestionOptions.sortOrder)),
    db.select({ count: sql<number>`count(*)::int` }).from(bookingQuestionOptions).where(where),
    query.limit,
    query.offset,
  )
}

export async function getBookingQuestionOptionById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(bookingQuestionOptions)
    .where(eq(bookingQuestionOptions.id, id))
    .limit(1)
  return row ?? null
}

export async function createBookingQuestionOption(
  db: PostgresJsDatabase,
  data: CreateBookingQuestionOptionInput,
) {
  const [row] = await db.insert(bookingQuestionOptions).values(data).returning()
  return row ?? null
}

export async function updateBookingQuestionOption(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateBookingQuestionOptionInput,
) {
  const [row] = await db
    .update(bookingQuestionOptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bookingQuestionOptions.id, id))
    .returning()
  return row ?? null
}

export async function deleteBookingQuestionOption(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(bookingQuestionOptions)
    .where(eq(bookingQuestionOptions.id, id))
    .returning({ id: bookingQuestionOptions.id })
  return row ?? null
}

export async function listBookingQuestionUnitTriggers(
  db: PostgresJsDatabase,
  query: BookingQuestionUnitTriggerListQuery,
) {
  const conditions = []
  if (query.productBookingQuestionId)
    conditions.push(
      eq(bookingQuestionUnitTriggers.productBookingQuestionId, query.productBookingQuestionId),
    )
  if (query.unitId) conditions.push(eq(bookingQuestionUnitTriggers.unitId, query.unitId))
  if (query.active !== undefined)
    conditions.push(eq(bookingQuestionUnitTriggers.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(bookingQuestionUnitTriggers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(bookingQuestionUnitTriggers.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(bookingQuestionUnitTriggers).where(where),
    query.limit,
    query.offset,
  )
}

export async function getBookingQuestionUnitTriggerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(bookingQuestionUnitTriggers)
    .where(eq(bookingQuestionUnitTriggers.id, id))
    .limit(1)
  return row ?? null
}

export async function createBookingQuestionUnitTrigger(
  db: PostgresJsDatabase,
  data: CreateBookingQuestionUnitTriggerInput,
) {
  const [row] = await db.insert(bookingQuestionUnitTriggers).values(data).returning()
  return row ?? null
}

export async function updateBookingQuestionUnitTrigger(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateBookingQuestionUnitTriggerInput,
) {
  const [row] = await db
    .update(bookingQuestionUnitTriggers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bookingQuestionUnitTriggers.id, id))
    .returning()
  return row ?? null
}

export async function deleteBookingQuestionUnitTrigger(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(bookingQuestionUnitTriggers)
    .where(eq(bookingQuestionUnitTriggers.id, id))
    .returning({ id: bookingQuestionUnitTriggers.id })
  return row ?? null
}

export async function listBookingQuestionOptionTriggers(
  db: PostgresJsDatabase,
  query: BookingQuestionOptionTriggerListQuery,
) {
  const conditions = []
  if (query.productBookingQuestionId)
    conditions.push(
      eq(bookingQuestionOptionTriggers.productBookingQuestionId, query.productBookingQuestionId),
    )
  if (query.optionId) conditions.push(eq(bookingQuestionOptionTriggers.optionId, query.optionId))
  if (query.active !== undefined)
    conditions.push(eq(bookingQuestionOptionTriggers.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(bookingQuestionOptionTriggers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(bookingQuestionOptionTriggers.createdAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingQuestionOptionTriggers)
      .where(where),
    query.limit,
    query.offset,
  )
}

export async function getBookingQuestionOptionTriggerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(bookingQuestionOptionTriggers)
    .where(eq(bookingQuestionOptionTriggers.id, id))
    .limit(1)
  return row ?? null
}

export async function createBookingQuestionOptionTrigger(
  db: PostgresJsDatabase,
  data: CreateBookingQuestionOptionTriggerInput,
) {
  const [row] = await db.insert(bookingQuestionOptionTriggers).values(data).returning()
  return row ?? null
}

export async function updateBookingQuestionOptionTrigger(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateBookingQuestionOptionTriggerInput,
) {
  const [row] = await db
    .update(bookingQuestionOptionTriggers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bookingQuestionOptionTriggers.id, id))
    .returning()
  return row ?? null
}

export async function deleteBookingQuestionOptionTrigger(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(bookingQuestionOptionTriggers)
    .where(eq(bookingQuestionOptionTriggers.id, id))
    .returning({ id: bookingQuestionOptionTriggers.id })
  return row ?? null
}

export async function listBookingQuestionExtraTriggers(
  db: PostgresJsDatabase,
  query: BookingQuestionExtraTriggerListQuery,
) {
  const conditions = []
  if (query.productBookingQuestionId)
    conditions.push(
      eq(bookingQuestionExtraTriggers.productBookingQuestionId, query.productBookingQuestionId),
    )
  if (query.productExtraId)
    conditions.push(eq(bookingQuestionExtraTriggers.productExtraId, query.productExtraId))
  if (query.optionExtraConfigId)
    conditions.push(eq(bookingQuestionExtraTriggers.optionExtraConfigId, query.optionExtraConfigId))
  if (query.active !== undefined)
    conditions.push(eq(bookingQuestionExtraTriggers.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(bookingQuestionExtraTriggers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(bookingQuestionExtraTriggers.createdAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingQuestionExtraTriggers)
      .where(where),
    query.limit,
    query.offset,
  )
}

export async function getBookingQuestionExtraTriggerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(bookingQuestionExtraTriggers)
    .where(eq(bookingQuestionExtraTriggers.id, id))
    .limit(1)
  return row ?? null
}

export async function createBookingQuestionExtraTrigger(
  db: PostgresJsDatabase,
  data: CreateBookingQuestionExtraTriggerInput,
) {
  const [row] = await db.insert(bookingQuestionExtraTriggers).values(data).returning()
  return row ?? null
}

export async function updateBookingQuestionExtraTrigger(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateBookingQuestionExtraTriggerInput,
) {
  const [row] = await db
    .update(bookingQuestionExtraTriggers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bookingQuestionExtraTriggers.id, id))
    .returning()
  return row ?? null
}

export async function deleteBookingQuestionExtraTrigger(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(bookingQuestionExtraTriggers)
    .where(eq(bookingQuestionExtraTriggers.id, id))
    .returning({ id: bookingQuestionExtraTriggers.id })
  return row ?? null
}
