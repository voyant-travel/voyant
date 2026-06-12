import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  channelInventoryReleaseExecutions,
  channelReconciliationItems,
  channelReconciliationRuns,
  channelSettlementItems,
  channelSettlementRuns,
} from "../schema.js"
import { paginate, toDateOrNull } from "./helpers.js"
import type {
  ChannelInventoryReleaseExecutionListQuery,
  ChannelReconciliationItemListQuery,
  ChannelReconciliationRunListQuery,
  ChannelSettlementItemListQuery,
  ChannelSettlementRunListQuery,
  CreateChannelInventoryReleaseExecutionInput,
  CreateChannelReconciliationItemInput,
  CreateChannelReconciliationRunInput,
  CreateChannelSettlementItemInput,
  CreateChannelSettlementRunInput,
  UpdateChannelInventoryReleaseExecutionInput,
  UpdateChannelReconciliationItemInput,
  UpdateChannelReconciliationRunInput,
  UpdateChannelSettlementItemInput,
  UpdateChannelSettlementRunInput,
} from "./types.js"

export const settlementServiceOperations = {
  async listSettlementRuns(db: PostgresJsDatabase, query: ChannelSettlementRunListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelSettlementRuns.channelId, query.channelId))
    if (query.contractId) conditions.push(eq(channelSettlementRuns.contractId, query.contractId))
    if (query.status) conditions.push(eq(channelSettlementRuns.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementRuns)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementRuns.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelSettlementRuns).where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementRunById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementRuns)
      .where(eq(channelSettlementRuns.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementRun(db: PostgresJsDatabase, data: CreateChannelSettlementRunInput) {
    const { generatedAt, postedAt, paidAt, ...rest } = data
    const [row] = await db
      .insert(channelSettlementRuns)
      .values({
        ...rest,
        generatedAt: toDateOrNull(generatedAt),
        postedAt: toDateOrNull(postedAt),
        paidAt: toDateOrNull(paidAt),
      })
      .returning()
    return row
  },

  async updateSettlementRun(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementRunInput,
  ) {
    const { generatedAt, postedAt, paidAt, ...rest } = data
    const [row] = await db
      .update(channelSettlementRuns)
      .set({
        ...rest,
        generatedAt: toDateOrNull(generatedAt),
        postedAt: toDateOrNull(postedAt),
        paidAt: toDateOrNull(paidAt),
        updatedAt: new Date(),
      })
      .where(eq(channelSettlementRuns.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementRun(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementRuns)
      .where(eq(channelSettlementRuns.id, id))
      .returning({ id: channelSettlementRuns.id })
    return row ?? null
  },

  async listSettlementItems(db: PostgresJsDatabase, query: ChannelSettlementItemListQuery) {
    const conditions = []
    if (query.settlementRunId) {
      conditions.push(eq(channelSettlementItems.settlementRunId, query.settlementRunId))
    }
    if (query.bookingLinkId) {
      conditions.push(eq(channelSettlementItems.bookingLinkId, query.bookingLinkId))
    }
    if (query.bookingId) conditions.push(eq(channelSettlementItems.bookingId, query.bookingId))
    if (query.status) conditions.push(eq(channelSettlementItems.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementItems)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementItems.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelSettlementItems).where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementItemById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementItems)
      .where(eq(channelSettlementItems.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementItem(db: PostgresJsDatabase, data: CreateChannelSettlementItemInput) {
    const { remittanceDueAt, paidAt, ...rest } = data
    const [row] = await db
      .insert(channelSettlementItems)
      .values({
        ...rest,
        remittanceDueAt: toDateOrNull(remittanceDueAt),
        paidAt: toDateOrNull(paidAt),
      })
      .returning()
    return row
  },

  async updateSettlementItem(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementItemInput,
  ) {
    const { remittanceDueAt, paidAt, ...rest } = data
    const [row] = await db
      .update(channelSettlementItems)
      .set({
        ...rest,
        remittanceDueAt: toDateOrNull(remittanceDueAt),
        paidAt: toDateOrNull(paidAt),
        updatedAt: new Date(),
      })
      .where(eq(channelSettlementItems.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementItem(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementItems)
      .where(eq(channelSettlementItems.id, id))
      .returning({ id: channelSettlementItems.id })
    return row ?? null
  },

  async listReconciliationRuns(db: PostgresJsDatabase, query: ChannelReconciliationRunListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelReconciliationRuns.channelId, query.channelId))
    if (query.contractId) {
      conditions.push(eq(channelReconciliationRuns.contractId, query.contractId))
    }
    if (query.status) conditions.push(eq(channelReconciliationRuns.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReconciliationRuns)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReconciliationRuns.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelReconciliationRuns).where(where),
      query.limit,
      query.offset,
    )
  },

  async getReconciliationRunById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReconciliationRuns)
      .where(eq(channelReconciliationRuns.id, id))
      .limit(1)
    return row ?? null
  },

  async createReconciliationRun(db: PostgresJsDatabase, data: CreateChannelReconciliationRunInput) {
    const { startedAt, completedAt, ...rest } = data
    const [row] = await db
      .insert(channelReconciliationRuns)
      .values({
        ...rest,
        startedAt: toDateOrNull(startedAt),
        completedAt: toDateOrNull(completedAt),
      })
      .returning()
    return row
  },

  async updateReconciliationRun(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReconciliationRunInput,
  ) {
    const { startedAt, completedAt, ...rest } = data
    const [row] = await db
      .update(channelReconciliationRuns)
      .set({
        ...rest,
        startedAt: toDateOrNull(startedAt),
        completedAt: toDateOrNull(completedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelReconciliationRuns.id, id))
      .returning()
    return row ?? null
  },

  async deleteReconciliationRun(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReconciliationRuns)
      .where(eq(channelReconciliationRuns.id, id))
      .returning({ id: channelReconciliationRuns.id })
    return row ?? null
  },

  async listReconciliationItems(db: PostgresJsDatabase, query: ChannelReconciliationItemListQuery) {
    const conditions = []
    if (query.reconciliationRunId) {
      conditions.push(eq(channelReconciliationItems.reconciliationRunId, query.reconciliationRunId))
    }
    if (query.bookingLinkId) {
      conditions.push(eq(channelReconciliationItems.bookingLinkId, query.bookingLinkId))
    }
    if (query.bookingId) {
      conditions.push(eq(channelReconciliationItems.bookingId, query.bookingId))
    }
    if (query.issueType) conditions.push(eq(channelReconciliationItems.issueType, query.issueType))
    if (query.resolutionStatus) {
      conditions.push(eq(channelReconciliationItems.resolutionStatus, query.resolutionStatus))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReconciliationItems)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReconciliationItems.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelReconciliationItems)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getReconciliationItemById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReconciliationItems)
      .where(eq(channelReconciliationItems.id, id))
      .limit(1)
    return row ?? null
  },

  async createReconciliationItem(
    db: PostgresJsDatabase,
    data: CreateChannelReconciliationItemInput,
  ) {
    const { resolvedAt, ...rest } = data
    const [row] = await db
      .insert(channelReconciliationItems)
      .values({
        ...rest,
        resolvedAt: toDateOrNull(resolvedAt),
      })
      .returning()
    return row
  },

  async updateReconciliationItem(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReconciliationItemInput,
  ) {
    const { resolvedAt, ...rest } = data
    const [row] = await db
      .update(channelReconciliationItems)
      .set({
        ...rest,
        resolvedAt: toDateOrNull(resolvedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelReconciliationItems.id, id))
      .returning()
    return row ?? null
  },

  async deleteReconciliationItem(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReconciliationItems)
      .where(eq(channelReconciliationItems.id, id))
      .returning({ id: channelReconciliationItems.id })
    return row ?? null
  },

  async listReleaseExecutions(
    db: PostgresJsDatabase,
    query: ChannelInventoryReleaseExecutionListQuery,
  ) {
    const conditions = []
    if (query.allotmentId) {
      conditions.push(eq(channelInventoryReleaseExecutions.allotmentId, query.allotmentId))
    }
    if (query.releaseRuleId) {
      conditions.push(eq(channelInventoryReleaseExecutions.releaseRuleId, query.releaseRuleId))
    }
    if (query.targetId) {
      conditions.push(eq(channelInventoryReleaseExecutions.targetId, query.targetId))
    }
    if (query.slotId) conditions.push(eq(channelInventoryReleaseExecutions.slotId, query.slotId))
    if (query.status) conditions.push(eq(channelInventoryReleaseExecutions.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryReleaseExecutions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryReleaseExecutions.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryReleaseExecutions)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getReleaseExecutionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryReleaseExecutions)
      .where(eq(channelInventoryReleaseExecutions.id, id))
      .limit(1)
    return row ?? null
  },

  async createReleaseExecution(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryReleaseExecutionInput,
  ) {
    const { executedAt, ...rest } = data
    const [row] = await db
      .insert(channelInventoryReleaseExecutions)
      .values({
        ...rest,
        executedAt: toDateOrNull(executedAt),
      })
      .returning()
    return row
  },

  async updateReleaseExecution(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryReleaseExecutionInput,
  ) {
    const { executedAt, ...rest } = data
    const [row] = await db
      .update(channelInventoryReleaseExecutions)
      .set({
        ...rest,
        executedAt: toDateOrNull(executedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelInventoryReleaseExecutions.id, id))
      .returning()
    return row ?? null
  },

  async deleteReleaseExecution(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryReleaseExecutions)
      .where(eq(channelInventoryReleaseExecutions.id, id))
      .returning({ id: channelInventoryReleaseExecutions.id })
    return row ?? null
  },
}
