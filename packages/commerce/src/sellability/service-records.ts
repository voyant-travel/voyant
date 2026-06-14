import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  offerExpirationEvents,
  offerRefreshRuns,
  sellabilityExplanations,
  sellabilityPolicies,
  sellabilityPolicyResults,
} from "./schema.js"
import { normalizeDateTime, paginate } from "./service-shared.js"
import type {
  insertOfferExpirationEventSchema,
  insertOfferRefreshRunSchema,
  insertSellabilityExplanationSchema,
  insertSellabilityPolicyResultSchema,
  insertSellabilityPolicySchema,
  offerExpirationEventListQuerySchema,
  offerRefreshRunListQuerySchema,
  sellabilityExplanationListQuerySchema,
  sellabilityPolicyListQuerySchema,
  sellabilityPolicyResultListQuerySchema,
  updateOfferExpirationEventSchema,
  updateOfferRefreshRunSchema,
  updateSellabilityExplanationSchema,
  updateSellabilityPolicyResultSchema,
  updateSellabilityPolicySchema,
} from "./validation.js"

type SellabilityPolicyListQuery = z.infer<typeof sellabilityPolicyListQuerySchema>
type CreateSellabilityPolicyInput = z.infer<typeof insertSellabilityPolicySchema>
type UpdateSellabilityPolicyInput = z.infer<typeof updateSellabilityPolicySchema>
type SellabilityPolicyResultListQuery = z.infer<typeof sellabilityPolicyResultListQuerySchema>
type CreateSellabilityPolicyResultInput = z.infer<typeof insertSellabilityPolicyResultSchema>
type UpdateSellabilityPolicyResultInput = z.infer<typeof updateSellabilityPolicyResultSchema>
type OfferRefreshRunListQuery = z.infer<typeof offerRefreshRunListQuerySchema>
type CreateOfferRefreshRunInput = z.infer<typeof insertOfferRefreshRunSchema>
type UpdateOfferRefreshRunInput = z.infer<typeof updateOfferRefreshRunSchema>
type OfferExpirationEventListQuery = z.infer<typeof offerExpirationEventListQuerySchema>
type CreateOfferExpirationEventInput = z.infer<typeof insertOfferExpirationEventSchema>
type UpdateOfferExpirationEventInput = z.infer<typeof updateOfferExpirationEventSchema>
type SellabilityExplanationListQuery = z.infer<typeof sellabilityExplanationListQuerySchema>
type CreateSellabilityExplanationInput = z.infer<typeof insertSellabilityExplanationSchema>
type UpdateSellabilityExplanationInput = z.infer<typeof updateSellabilityExplanationSchema>

export async function listPolicies(db: PostgresJsDatabase, query: SellabilityPolicyListQuery) {
  const conditions = []
  if (query.scope) conditions.push(eq(sellabilityPolicies.scope, query.scope))
  if (query.policyType) conditions.push(eq(sellabilityPolicies.policyType, query.policyType))
  if (query.productId) conditions.push(eq(sellabilityPolicies.productId, query.productId))
  if (query.optionId) conditions.push(eq(sellabilityPolicies.optionId, query.optionId))
  if (query.marketId) conditions.push(eq(sellabilityPolicies.marketId, query.marketId))
  if (query.channelId) conditions.push(eq(sellabilityPolicies.channelId, query.channelId))
  if (query.active !== undefined) conditions.push(eq(sellabilityPolicies.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(sellabilityPolicies)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(sellabilityPolicies.priority), asc(sellabilityPolicies.name)),
    db.select({ count: sql<number>`count(*)::int` }).from(sellabilityPolicies).where(where),
    query.limit,
    query.offset,
  )
}
export async function getPolicyById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(sellabilityPolicies)
    .where(eq(sellabilityPolicies.id, id))
    .limit(1)
  return row ?? null
}
export async function createPolicy(db: PostgresJsDatabase, data: CreateSellabilityPolicyInput) {
  const [row] = await db.insert(sellabilityPolicies).values(data).returning()
  return row ?? null
}
export async function updatePolicy(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateSellabilityPolicyInput,
) {
  const [row] = await db
    .update(sellabilityPolicies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sellabilityPolicies.id, id))
    .returning()
  return row ?? null
}
export async function deletePolicy(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(sellabilityPolicies)
    .where(eq(sellabilityPolicies.id, id))
    .returning({ id: sellabilityPolicies.id })
  return row ?? null
}
export async function listPolicyResults(
  db: PostgresJsDatabase,
  query: SellabilityPolicyResultListQuery,
) {
  const conditions = []
  if (query.snapshotId) conditions.push(eq(sellabilityPolicyResults.snapshotId, query.snapshotId))
  if (query.snapshotItemId)
    conditions.push(eq(sellabilityPolicyResults.snapshotItemId, query.snapshotItemId))
  if (query.policyId) conditions.push(eq(sellabilityPolicyResults.policyId, query.policyId))
  if (query.status) conditions.push(eq(sellabilityPolicyResults.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(sellabilityPolicyResults)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(sellabilityPolicyResults.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(sellabilityPolicyResults).where(where),
    query.limit,
    query.offset,
  )
}
export async function getPolicyResultById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(sellabilityPolicyResults)
    .where(eq(sellabilityPolicyResults.id, id))
    .limit(1)
  return row ?? null
}
export async function createPolicyResult(
  db: PostgresJsDatabase,
  data: CreateSellabilityPolicyResultInput,
) {
  const [row] = await db.insert(sellabilityPolicyResults).values(data).returning()
  return row ?? null
}
export async function updatePolicyResult(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateSellabilityPolicyResultInput,
) {
  const [row] = await db
    .update(sellabilityPolicyResults)
    .set(data)
    .where(eq(sellabilityPolicyResults.id, id))
    .returning()
  return row ?? null
}
export async function deletePolicyResult(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(sellabilityPolicyResults)
    .where(eq(sellabilityPolicyResults.id, id))
    .returning({ id: sellabilityPolicyResults.id })
  return row ?? null
}
export async function listOfferRefreshRuns(
  db: PostgresJsDatabase,
  query: OfferRefreshRunListQuery,
) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerRefreshRuns.offerId, query.offerId))
  if (query.snapshotId) conditions.push(eq(offerRefreshRuns.snapshotId, query.snapshotId))
  if (query.status) conditions.push(eq(offerRefreshRuns.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerRefreshRuns)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(offerRefreshRuns.startedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerRefreshRuns).where(where),
    query.limit,
    query.offset,
  )
}
export async function getOfferRefreshRunById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(offerRefreshRuns).where(eq(offerRefreshRuns.id, id)).limit(1)
  return row ?? null
}
export async function createOfferRefreshRun(
  db: PostgresJsDatabase,
  data: CreateOfferRefreshRunInput,
) {
  const [row] = await db
    .insert(offerRefreshRuns)
    .values({
      ...data,
      startedAt: normalizeDateTime(data.startedAt) ?? new Date(),
      completedAt: normalizeDateTime(data.completedAt),
    })
    .returning()
  return row ?? null
}
export async function updateOfferRefreshRun(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferRefreshRunInput,
) {
  const [row] = await db
    .update(offerRefreshRuns)
    .set({
      ...data,
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(offerRefreshRuns.id, id))
    .returning()
  return row ?? null
}
export async function deleteOfferRefreshRun(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerRefreshRuns)
    .where(eq(offerRefreshRuns.id, id))
    .returning({ id: offerRefreshRuns.id })
  return row ?? null
}
export async function listOfferExpirationEvents(
  db: PostgresJsDatabase,
  query: OfferExpirationEventListQuery,
) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerExpirationEvents.offerId, query.offerId))
  if (query.snapshotId) conditions.push(eq(offerExpirationEvents.snapshotId, query.snapshotId))
  if (query.status) conditions.push(eq(offerExpirationEvents.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerExpirationEvents)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(offerExpirationEvents.expiresAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerExpirationEvents).where(where),
    query.limit,
    query.offset,
  )
}
export async function getOfferExpirationEventById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerExpirationEvents)
    .where(eq(offerExpirationEvents.id, id))
    .limit(1)
  return row ?? null
}
export async function createOfferExpirationEvent(
  db: PostgresJsDatabase,
  data: CreateOfferExpirationEventInput,
) {
  const [row] = await db
    .insert(offerExpirationEvents)
    .values({
      ...data,
      expiresAt: new Date(data.expiresAt),
      expiredAt: normalizeDateTime(data.expiredAt),
    })
    .returning()
  return row ?? null
}
export async function updateOfferExpirationEvent(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferExpirationEventInput,
) {
  const [row] = await db
    .update(offerExpirationEvents)
    .set({
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      expiredAt: normalizeDateTime(data.expiredAt),
      updatedAt: new Date(),
    })
    .where(eq(offerExpirationEvents.id, id))
    .returning()
  return row ?? null
}
export async function deleteOfferExpirationEvent(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerExpirationEvents)
    .where(eq(offerExpirationEvents.id, id))
    .returning({ id: offerExpirationEvents.id })
  return row ?? null
}
export async function listExplanations(
  db: PostgresJsDatabase,
  query: SellabilityExplanationListQuery,
) {
  const conditions = []
  if (query.snapshotId) conditions.push(eq(sellabilityExplanations.snapshotId, query.snapshotId))
  if (query.snapshotItemId)
    conditions.push(eq(sellabilityExplanations.snapshotItemId, query.snapshotItemId))
  if (query.explanationType)
    conditions.push(eq(sellabilityExplanations.explanationType, query.explanationType))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(sellabilityExplanations)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(sellabilityExplanations.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(sellabilityExplanations).where(where),
    query.limit,
    query.offset,
  )
}
export async function getExplanationById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(sellabilityExplanations)
    .where(eq(sellabilityExplanations.id, id))
    .limit(1)
  return row ?? null
}
export async function createExplanation(
  db: PostgresJsDatabase,
  data: CreateSellabilityExplanationInput,
) {
  const [row] = await db.insert(sellabilityExplanations).values(data).returning()
  return row ?? null
}
export async function updateExplanation(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateSellabilityExplanationInput,
) {
  const [row] = await db
    .update(sellabilityExplanations)
    .set(data)
    .where(eq(sellabilityExplanations.id, id))
    .returning()
  return row ?? null
}
export async function deleteExplanation(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(sellabilityExplanations)
    .where(eq(sellabilityExplanations.id, id))
    .returning({ id: sellabilityExplanations.id })
  return row ?? null
}
