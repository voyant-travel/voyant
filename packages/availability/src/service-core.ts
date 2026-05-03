import type { EventBus } from "@voyantjs/core"
import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { AVAILABILITY_SLOT_CHANGED_EVENT, type AvailabilitySlotChangedEvent } from "./events.js"
import { productsRef } from "./products-ref.js"
import {
  availabilityCloseouts,
  availabilityRules,
  availabilitySlots,
  availabilityStartTimes,
} from "./schema.js"
import type {
  AvailabilityCloseoutListQuery,
  AvailabilityRuleListQuery,
  AvailabilitySlotListQuery,
  AvailabilityStartTimeListQuery,
  CreateAvailabilityCloseoutInput,
  CreateAvailabilityRuleInput,
  CreateAvailabilitySlotInput,
  CreateAvailabilityStartTimeInput,
  UpdateAvailabilityCloseoutInput,
  UpdateAvailabilityRuleInput,
  UpdateAvailabilitySlotInput,
  UpdateAvailabilityStartTimeInput,
} from "./service-shared.js"
import { paginate, toDateOrNull } from "./service-shared.js"

export async function listRules(db: PostgresJsDatabase, query: AvailabilityRuleListQuery) {
  const conditions = []
  if (query.productId) conditions.push(eq(availabilityRules.productId, query.productId))
  if (query.optionId) conditions.push(eq(availabilityRules.optionId, query.optionId))
  if (query.facilityId) conditions.push(eq(availabilityRules.facilityId, query.facilityId))
  if (query.active !== undefined) conditions.push(eq(availabilityRules.active, query.active))

  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select({ ...getTableColumns(availabilityRules), productName: productsRef.name })
      .from(availabilityRules)
      .leftJoin(productsRef, eq(availabilityRules.productId, productsRef.id))
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(availabilityRules.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(availabilityRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createRule(db: PostgresJsDatabase, data: CreateAvailabilityRuleInput) {
  const [row] = await db.insert(availabilityRules).values(data).returning()
  return row
}

export async function updateRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateAvailabilityRuleInput,
) {
  const [row] = await db
    .update(availabilityRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(availabilityRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(availabilityRules)
    .where(eq(availabilityRules.id, id))
    .returning({ id: availabilityRules.id })
  return row ?? null
}

export async function listStartTimes(
  db: PostgresJsDatabase,
  query: AvailabilityStartTimeListQuery,
) {
  const conditions = []
  if (query.productId) conditions.push(eq(availabilityStartTimes.productId, query.productId))
  if (query.optionId) conditions.push(eq(availabilityStartTimes.optionId, query.optionId))
  if (query.facilityId) conditions.push(eq(availabilityStartTimes.facilityId, query.facilityId))
  if (query.active !== undefined) conditions.push(eq(availabilityStartTimes.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select({ ...getTableColumns(availabilityStartTimes), productName: productsRef.name })
      .from(availabilityStartTimes)
      .leftJoin(productsRef, eq(availabilityStartTimes.productId, productsRef.id))
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(availabilityStartTimes.sortOrder, availabilityStartTimes.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(availabilityStartTimes).where(where),
    query.limit,
    query.offset,
  )
}

export async function getStartTimeById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(availabilityStartTimes)
    .where(eq(availabilityStartTimes.id, id))
    .limit(1)
  return row ?? null
}

export async function createStartTime(
  db: PostgresJsDatabase,
  data: CreateAvailabilityStartTimeInput,
) {
  const [row] = await db.insert(availabilityStartTimes).values(data).returning()
  return row
}

export async function updateStartTime(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateAvailabilityStartTimeInput,
) {
  const [row] = await db
    .update(availabilityStartTimes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(availabilityStartTimes.id, id))
    .returning()
  return row ?? null
}

export async function deleteStartTime(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(availabilityStartTimes)
    .where(eq(availabilityStartTimes.id, id))
    .returning({ id: availabilityStartTimes.id })
  return row ?? null
}

export async function listSlots(db: PostgresJsDatabase, query: AvailabilitySlotListQuery) {
  const conditions = []
  if (query.productId) conditions.push(eq(availabilitySlots.productId, query.productId))
  if (query.itineraryId) conditions.push(eq(availabilitySlots.itineraryId, query.itineraryId))
  if (query.optionId) conditions.push(eq(availabilitySlots.optionId, query.optionId))
  if (query.facilityId) conditions.push(eq(availabilitySlots.facilityId, query.facilityId))
  if (query.availabilityRuleId) {
    conditions.push(eq(availabilitySlots.availabilityRuleId, query.availabilityRuleId))
  }
  if (query.startTimeId) conditions.push(eq(availabilitySlots.startTimeId, query.startTimeId))
  if (query.dateLocal) conditions.push(eq(availabilitySlots.dateLocal, query.dateLocal))
  if (query.status) conditions.push(eq(availabilitySlots.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select({ ...getTableColumns(availabilitySlots), productName: productsRef.name })
      .from(availabilitySlots)
      .leftJoin(productsRef, eq(availabilitySlots.productId, productsRef.id))
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(availabilitySlots.startsAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(availabilitySlots).where(where),
    query.limit,
    query.offset,
  )
}

export async function getSlotById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, id))
    .limit(1)
  return row ?? null
}

export async function createSlot(db: PostgresJsDatabase, data: CreateAvailabilitySlotInput) {
  const [row] = await db
    .insert(availabilitySlots)
    .values({
      ...data,
      startsAt: new Date(data.startsAt),
      endsAt: toDateOrNull(data.endsAt),
    })
    .returning()
  return row
}

export interface UpdateSlotRuntime {
  /**
   * Optional event bus. When wired, `updateSlot` emits
   * `availability.slot.changed` after a successful update so channel-push
   * (and other availability subscribers) can react to operator edits and
   * scheduled refresh recomputations.
   *
   * Per docs/architecture/channel-push-architecture.md §5.1.
   */
  eventBus?: EventBus
  /**
   * Origin of the change. Defaults to `"manual"` (operator edit). The
   * scheduled-refresh job passes `"refresh"` so dashboards can attribute
   * drift correctly.
   */
  source?: AvailabilitySlotChangedEvent["source"]
}

export async function updateSlot(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateAvailabilitySlotInput,
  runtime: UpdateSlotRuntime = {},
) {
  const patch = {
    ...data,
    startsAt: data.startsAt === undefined ? undefined : new Date(data.startsAt),
    endsAt: data.endsAt === undefined ? undefined : toDateOrNull(data.endsAt),
    updatedAt: new Date(),
  }

  const [row] = await db
    .update(availabilitySlots)
    .set(patch)
    .where(eq(availabilitySlots.id, id))
    .returning()
  if (!row) return null

  // Emit on every successful update — subscribers decide what to do with
  // the signal (channel-push only acts on availability-affecting fields).
  // The intent table on the channel-push side collapses by (channelId,
  // slotId) so duplicate or noisy emits are harmless. Per §5.1.
  const eventBus = runtime.eventBus
  if (eventBus) {
    const payload: AvailabilitySlotChangedEvent = {
      slotId: row.id,
      productId: row.productId,
      optionId: row.optionId ?? null,
      startsAt: row.startsAt,
      remainingPax: row.unlimited ? null : (row.remainingPax ?? null),
      unlimited: row.unlimited,
      source: runtime.source ?? "manual",
    }
    await eventBus.emit(AVAILABILITY_SLOT_CHANGED_EVENT, payload, {
      category: "domain",
      source: "service",
    })
  }

  return row
}

export async function deleteSlot(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(availabilitySlots)
    .where(eq(availabilitySlots.id, id))
    .returning({ id: availabilitySlots.id })
  return row ?? null
}

export async function listCloseouts(db: PostgresJsDatabase, query: AvailabilityCloseoutListQuery) {
  const conditions = []
  if (query.productId) conditions.push(eq(availabilityCloseouts.productId, query.productId))
  if (query.slotId) conditions.push(eq(availabilityCloseouts.slotId, query.slotId))
  if (query.dateLocal) conditions.push(eq(availabilityCloseouts.dateLocal, query.dateLocal))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select({ ...getTableColumns(availabilityCloseouts), productName: productsRef.name })
      .from(availabilityCloseouts)
      .leftJoin(productsRef, eq(availabilityCloseouts.productId, productsRef.id))
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(availabilityCloseouts.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(availabilityCloseouts).where(where),
    query.limit,
    query.offset,
  )
}

export async function getCloseoutById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(availabilityCloseouts)
    .where(eq(availabilityCloseouts.id, id))
    .limit(1)
  return row ?? null
}

export async function createCloseout(
  db: PostgresJsDatabase,
  data: CreateAvailabilityCloseoutInput,
) {
  const [row] = await db.insert(availabilityCloseouts).values(data).returning()
  return row
}

export async function updateCloseout(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateAvailabilityCloseoutInput,
) {
  const [row] = await db
    .update(availabilityCloseouts)
    .set(data)
    .where(eq(availabilityCloseouts.id, id))
    .returning()
  return row ?? null
}

export async function deleteCloseout(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(availabilityCloseouts)
    .where(eq(availabilityCloseouts.id, id))
    .returning({ id: availabilityCloseouts.id })
  return row ?? null
}
